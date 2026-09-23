# Authentication foundation — recovery and Google login

Review date: 2026-09-24. Local source implementation only; no provider configuration, credentials, SQL, migration, commit, push or deploy. Email/password remains available. Google Login and Stage C Google Drive integration are separate consent flows with separate purposes.

## Registration with auto-confirm

To allow password registrations to receive an immediate Auth session, the owner must change this setting manually in Supabase Dashboard: **Authentication → Providers → Email → Confirm email**, then turn **Confirm email** off and save. Do not change it automatically from this repository.

With confirmation disabled, Supabase may return a session immediately. The application still evaluates current database membership before routing: a new account remains `pending` with `role = NULL` and goes to the pending-approval page. It is never auto-approved and receives no tenant data. If Supabase returns no session, the application shows transitional confirmation guidance and does not claim that the browser is authenticated.

Disabling email confirmation means a password registration does not prove ownership through an email verification link. It may make the Auth account usable immediately, but administrator approval remains mandatory before school access. The owner should weigh this tradeoff against the school’s registration process and use controlled test accounts before changing production settings.

## Recovery incident: evidence and fix

Owner reports production recovery email delivery followed by GET /auth/v1/verify 303 and POST /auth/v1/token 422, then an expired-link message. SMTP previously used a Gmail password and was corrected toward an App Password by the owner. No SMTP secrets/configuration or production Auth logs were inspected here. A 422 alone does not establish expiry or a unique root cause.

Confirmed source defects:

1. Auth SDK 2.116.0 stores separate PKCE verifier slots but, by default, redirects do not carry their flow ID and server exchange uses the most recently written legacy verifier. A later recovery/signup/OAuth start can therefore replace the verifier selected for an earlier email. The old callback did not accept the SDK flow ID. An offline real-SDK reproduction starts recovery, then another Google flow, and receives a simulated bad_code_verifier 422 when the callback chooses the wrong verifier. It failed before the callback fix and passes afterward. This is a reproduced failure path consistent with the incident, not proof of the exact production sequence.
2. All callback failures were mapped to the same invalid/expired text, obscuring verifier and internal failures.
3. Password update cleared cookies then returned form state. Next cookie invalidation can rerender the reset page, whose missing-marker gate hides the successful form before its delayed client redirect. The action now redirects server-side to /login?reset=success after update and cleanup; the login page displays success. This also supports native POST without JavaScript.
4. Native HTTP testing showed next.config global Referrer-Policy overriding callback's no-referrer. Explicit callback/reset header rules now preserve no-referrer on the actual response.

Server SSR client now enables the installed SDK's `auth.experimental.appendPkceFlowIdToRedirects`. The resulting `sb_flow_id` is a nonsecret correlation ID, not a recovery credential. The SDK generates/persists its verifier; the application neither stores recovery tokens nor implements PKCE itself. Callback validates the ID shape and passes it to exchangeCodeForSession exactly once. Missing explicit slot fails closed without borrowing a different verifier. Old links without an ID still use the supported legacy SDK exchange; they cannot recover a verifier already overwritten/cleared. A fresh link after configuration/deployment is needed for that case.

This SDK option is experimental and currently defaults off. Lockfile is unchanged; review SDK API changes before upgrading. Supabase redirect allowlist must tolerate the appended query parameter BEFORE deploying this change (exact entries below). Recovery still needs the requesting browser/device's verifier cookie; changing browsers, clearing cookies, scanners consuming single-use links, invalid codes or Auth outage remain distinct failure possibilities. The app does not retry a consumed code or bypass PKCE.

Callback proxy no longer initializes/refreshes an older session before the callback owns its exchange. Writable auth actions/callback now propagate cookie write failures; read-only Server Components retain their existing tolerant adapter. The recovery marker remains a short-lived HttpOnly/SameSite=Lax UX marker bound to the user returned by getUser; it is not an authorization credential. Only the SDK PASSWORD_RECOVERY event opens recovery, never next=/reset-password or flow=google.

| Condition | Safe UI outcome |
|---|---|
| Valid recovery event + session/marker | New password + matching confirmation form |
| Known expired/missing consumed flow | Tautan pemulihan sudah tidak berlaku. Silakan minta tautan baru. |
| Missing/mismatched verifier | Explain same browser/device requirement and cleared browser data |
| Unknown callback/token/session failure | Pemulihan akun tidak dapat diproses saat ini. Silakan coba kembali. |
| Password committed | Server redirect to login, success notice; no new-link request |

A bare 422 is classified as internal/unknown unless its safe SDK code identifies the category. Raw provider messages, code, token or error_description are never rendered. The password form says: “Gunakan kata sandi yang kuat dan berbeda dari kata sandi akun Anda yang lain.” No custom password-history claim/check was added.

## Architecture and authorization

Password: login form -> validated Server Action -> Supabase signInWithPassword -> authenticated dashboard gate.

Google: separate native POST form -> Server Action -> signInWithOAuth(provider=google, scopes=openid email profile, prompt=select_account) -> trusted Supabase authorize endpoint -> Google -> Supabase callback -> application /auth/callback -> one PKCE exchange -> server active membership check -> dashboard or pending-approval. Recovery branches before tenant gating so users needing a password reset are not required to have active tenant access.

Google action accepts no callback, role or school from form data. It matches request Origin/Host through authOrigin and restricts origins to the exact production origin and localhost:3000. It validates the returned redirect against the configured Supabase /auth/v1/authorize endpoint. No arbitrary redirect, domain-based role, auto-approval, manual identity merge or service-role login/reset exists.

Authorization stays auth.uid -> profiles -> active school_memberships -> known role -> capabilities -> RLS. Dashboard/actions recheck context; callback success alone grants no tenant permission. Pending, rejected and suspended users remain gated. Accounts without an accessible active school get an explicit unavailable-school message. Existing RLS limitations (last-admin race and inactive-school helper semantics) remain documented in READINESS-2026-09-24.md; no database invariants were changed.

Google OAuth metadata supplies display information only. Migration 002 handle_new_user runs on INSERT auth.users, creates the profile and, if the configured default school is active, inserts a pending membership with NULL role. It does not accept a school or role from metadata. If no default active school exists, profile may exist without membership; the account remains outside tenants. 007 does not audit membership creation/login/password events; it audits the existing foundation mutation taxonomy.

## Existing accounts and identity linking

Use Supabase's supported automatic identity linking. Supabase documents matching-email linking into an existing user and safeguards concerning unconfirmed identities; the app does not infer or force identity from an email. See [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

Expected for an existing verified password user: Google identity links to the same auth.users.id, so profile and memberships remain attached to that UID and the new-user INSERT trigger does not run again. This expectation MUST be verified against the live project's identity/configuration, starting with a nonprivileged test account. Do not assume all unverified email, SSO or previously duplicated accounts have identical behavior. Never update auth.users, merge UIDs, copy membership by email, or use service role to resolve a mismatch.

Super-admin release gate: retain a tested password login, record the existing UID and membership IDs privately, then owner tests matching verified Google identity. Confirm unchanged UID, profile count, membership IDs/status/role, and expected linked identity. If a second UID/pending account appears, stop privileged OAuth rollout; do not promote it or transfer membership as a workaround. No new admin provisioning is added. Live identity linking and this super-admin check were not performed here.

## Data minimization and auth security review

Google scopes are only openid/email/profile. No Drive/Gmail/Calendar/Contacts or offline access request. No provider refresh token is requested. SDK can still return a Google access token; supabaseFetch removes provider_token/provider_refresh_token from successful Auth token responses BEFORE SDK session persistence. An offline real-SDK test decodes resulting cookies and verifies only application session credentials remain. No provider token database/localStorage/log storage is added. Stage C Drive backup must retain its own separate consent/credential boundary.

| Foundation area | Review outcome |
|---|---|
| Signup | Existing validated SSR action; metadata only full_name; pending trigger preserved |
| Email verification | Existing shared callback, SDK flow ID preserved; no role granted by verification |
| Password login | Existing generic errors, server validation and tenant gate unchanged |
| Google login | Separate POST action, minimum scopes, account chooser, pending/duplicate-click UI guard |
| Logout | Existing local sidebar logout and explicit global logout preserved; pending page uses existing default signOut scope |
| Recovery | Per-flow SDK verifier, no manual token storage, differentiated errors |
| Password update | Confirmation/server validation; authenticated updateUser; immediate success redirect |
| Callback | Single shared route, one exchange per request, no auto-retry, no user/role/tenant input accepted |
| Session refresh | Existing proxy remains on private/auth routes except callback exchange |
| Proxy | Auth refresh only, not authorization boundary; cookie rotation preserved |
| Cookies | SDK getAll/setAll; strict writes for starting/completing auth; short-lived recovery marker |
| Redirects | Existing safeNextPath rejects external/encoded separators; exact Google origin/endpoint checks |
| Membership gating | Valid active membership/role and active school required in application; RLS remains primary boundary |
| Inactive accounts | Pending/rejected/suspended/no active tenant cannot enter dashboard |
| Duplicate submit | Google pending disable + immediate ref lock; no promise of cross-tab idempotency |
| Generic errors | Allowlisted messages only; raw OAuth/callback descriptions discarded |
| Enumeration | Existing password/forgot generic responses preserved; no new account-existence endpoint |
| Server/client usage | Provider start and exchange server-side SSR, no secret/admin client; user session used for data |
| CSRF/state/PKCE | Next Server Action Origin/Host checks plus explicit origin allowlist; OAuth state handled by Supabase/Google, PKCE by SDK; no custom state bypass |
| Production/local | Exact listed origins and provider callbacks; cookies remain origin-specific; no cross-browser guarantee |

No claim that SameSite alone protects OAuth or that a flow ID authenticates a user. Actual provider state/consent behavior needs live manual testing. Recovery and callback responses are private/no-store; callback and reset use no-referrer. Auth pages' success notices are informational, never proof of authorization.

## Owner configuration — Google Auth Platform / Google Cloud

1. Select/create the intended Google Cloud project. In Google Auth Platform -> Branding, set application name SIM KB DEVFANTA MELATI, support email and developer contact controlled by the owner. Supply accurate app homepage/privacy/terms URLs and complete Google's domain/branding requirements; current privacy/terms pages still require owner review.
2. Audience: use External for ordinary Google accounts. While Testing, add only owner-controlled test users permitted by the console. Before public use, review publishing/verification requirements in the console; do not assume Testing, unverified branding or consent bypasses are production-ready.
3. Data Access: only openid, userinfo.email and userinfo.profile. Do not add Drive or offline scope for login.
4. Clients -> Create client -> Web application. Authorized JavaScript origins:
   - https://aplikasi-management-sekolah.vercel.app
   - http://localhost:3000 (development; prefer a separate development client/project when separating environments).
5. Authorized redirect URI: COPY the exact callback URL displayed in Supabase -> Authentication -> Sign In / Providers -> Google. For a standard hosted project its shape is `https://<project-ref>.supabase.co/auth/v1/callback`. The project ref was not read or invented. This is the Google-to-Supabase redirect, NOT the application's /auth/callback. Local Next.js against the same hosted Supabase uses this same Supabase callback, not a local Supabase URL.
6. Save Client ID/Client Secret into Supabase's Google provider settings only. Do not put the secret into this repo, Vercel NEXT_PUBLIC variables, docs, chat or browser code. No values are requested by this implementation.

These settings follow [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google). Follow the console's current branding/audience review prompts rather than claiming verification has already occurred.

## Owner configuration — Supabase

1. Authentication -> Sign In / Providers -> Google: enable provider, enter the Web client ID and secret from Google. Copy/check the displayed callback URI against Google Cloud character-for-character. Do not weaken provider verification/nonce settings to fix a redirect issue.
2. Authentication -> URL Configuration -> Site URL:
   `https://aplikasi-management-sekolah.vercel.app`
3. Redirect URLs: retain the exact legacy callbacks below and add flow-ID patterns BEFORE deployment. SDK adds sb_flow_id at the end of the given callback query. Star is a Supabase allowlist glob for the generated ID. The backslash before ? makes the query separator literal in the glob. Neither escape nor star belongs in the real redirect URL sent by the application. No wildcard domains or arbitrary preview hosts are needed.

```text
https://aplikasi-management-sekolah.vercel.app/auth/callback
https://aplikasi-management-sekolah.vercel.app/auth/callback\?next=/dashboard
https://aplikasi-management-sekolah.vercel.app/auth/callback\?next=/reset-password
https://aplikasi-management-sekolah.vercel.app/auth/callback\?next=/dashboard&flow=google
https://aplikasi-management-sekolah.vercel.app/auth/callback\?next=/dashboard&sb_flow_id=*
https://aplikasi-management-sekolah.vercel.app/auth/callback\?next=/reset-password&sb_flow_id=*
https://aplikasi-management-sekolah.vercel.app/auth/callback\?next=/dashboard&flow=google&sb_flow_id=*
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback\?next=/dashboard
http://localhost:3000/auth/callback\?next=/reset-password
http://localhost:3000/auth/callback\?next=/dashboard&flow=google
http://localhost:3000/auth/callback\?next=/dashboard&sb_flow_id=*
http://localhost:3000/auth/callback\?next=/reset-password&sb_flow_id=*
http://localhost:3000/auth/callback\?next=/dashboard&flow=google&sb_flow_id=*
```

Check pattern acceptance and preservation of the full query in both environments using fresh emails. Supabase can fall back to Site URL when a redirect fails allowlist checks; that is not a token-expiry diagnosis. See [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls) and the installed SDK ExperimentalFeatureFlags documentation. Keep existing legacy reset-password redirect entries only if previously sent emails still require them; new links use /auth/callback. Localhost and 127.0.0.1 are different cookie origins: use localhost:3000 consistently for this OAuth flow. LAN hosts are not enabled for Google login.

4. Email recovery/confirmation templates must retain the Supabase verification flow and requested redirect (including query), normally via ConfirmationURL. Do not rewrite recovery links to a bare SiteURL/reset-password or strip sb_flow_id. Review template configuration manually without copying secrets/tokens into the repo.
5. Custom SMTP: owner verifies the already configured Gmail App Password and delivery settings privately. This change neither reads nor replaces SMTP credentials. SMTP acceptance alone does not prove PKCE exchange success.
6. Existing Next deployment still needs the correct Supabase URL/publishable key at BUILD time. This review never inspected env files or changed deployment variables. Google Client Secret belongs to Supabase provider settings, not Next public configuration.

## Manual smoke plan after owner configuration/review/deployment

- First use nonprivileged owner-controlled accounts. Password login still works; wrong password and forgot known/unknown email remain generic.
- Fresh recovery in the same browser: email -> callback -> new-password form; deliberately start another auth flow before opening the first link; correct flow still succeeds. Test missing cookie/different browser, expired/reused code and provider outage separately. Verify success lands at login and new password works; no expired page after a successful update.
- Google account chooser success, cancel/back, provider disabled/error, callback error, double click and keyboard/mobile behavior. Confirm callback response session cookies, no provider tokens in stored session (inspect privately; do not export cookie values).
- New Google user: profile plus default-school pending/NULL-role membership only; no tenant dashboard until authorized approval. Test rejected/suspended/no active school and active members of each role. Foreign school_id/role metadata must not grant permission.
- Existing verified password account: same UID/profile/memberships after Google login; repeat password login. Only then perform the super-admin identity gate above. If UID differs, stop and investigate using supported Supabase tooling; never merge manually.
- Separate production and localhost sessions. Confirm callback query includes sb_flow_id, redirects use the intended origin, local cookie never substitutes for production cookie. Inspect safe status/category only for failures, not raw token/URL logs.
- Verify local/global logout behavior and direct database RLS isolation with ordinary users in disposable fixtures. No production SQL or seed belongs in this checklist.

## Validation and changed files

Final results are recorded below after validation. Unit/static/mocked tests do not prove live Google consent, SMTP, provider identity linking or live RLS. HTTP smoke uses local production build with `https://test.invalid` and a dummy publishable key; no external OAuth redirect is followed and no valid signup/reset is sent to production. NEXT_PUBLIC dummy values were supplied at build time, not written to env files. That local .next artifact is for testing only and must not be deployed as a real configured build.

Changed for this auth task: src/app/auth/google-actions.ts (new), src/components/auth/google-login.tsx (new), src/app/auth/callback/route.ts, src/app/auth/form-actions.ts, src/app/login/page.tsx, src/components/auth/auth-form.tsx, src/app/pending-approval/page.tsx, src/app/reset-password/actions.ts, src/app/reset-password/page.tsx, src/app/reset-password/reset-form.tsx, src/lib/recovery.ts, src/proxy.ts, src/utils/supabase/server.ts, src/utils/supabase/fetch.ts, next.config.ts, tests/foundation.test.mjs, tests/auth-google-http.mjs (new), docs/AUTH-FOUNDATION.md (new), and links in docs/PRODUCTION.md/docs/SECURITY.md plus the login/Drive separation note in docs/STORAGE.md.

Prior Stage C/readiness/academic changes remain in the working tree. A separate .env.example modification appeared during the task and was not read, edited or reverted by this work. Migrations 001–007, dependency manifests/lockfile and credentials are untouched by this implementation. No migration 008 is created.

Final validation: npm test **92 passed, 0 failed, 0 skipped** (72 existing at task start + 20 new auth/header cases); npm run lint, npm run typecheck and npm run build passed. Native HTTP Google smoke and existing invalid-registration POST smoke both passed on the local production build. Google smoke checks POST redirect, SDK S256 verifier cookie, flow-ID callback, scopes, CSRF rejection, cancellation and missing-verifier UI. It follows no external redirect. git diff --check and migration/dependency immutability checks passed. No live SMTP, actual Google consent/linking, successful production password mutation, visual browser automation or live RLS test was performed.

To repeat offline HTTP smoke, build/start with dummy Supabase configuration supplied only to the process, then run `node --dns-result-order=ipv4first tests/auth-google-http.mjs` and `node --dns-result-order=ipv4first tests/auth-post-smoke.mjs http://localhost:3000`. IPv4 was necessary here because another existing IPv6 localhost listener returned errors; that unrelated process was not modified. Our temporary server was stopped after testing.

Provider error fragments are not sent to a server route. A callback without a code therefore gets a safe generic failure rather than falsely claiming expiry; only recognized invalid/expired flow codes get the expired-link wording. This also means the exact cancellation reason may remain intentionally generic.
