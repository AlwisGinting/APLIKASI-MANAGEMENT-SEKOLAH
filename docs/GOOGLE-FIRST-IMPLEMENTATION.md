# Google-first and Akses Dasar: source implementation

Source and draft SQL only. Neither 008 nor 009 was executed in this task.
Production remains unchanged. Database/RLS and actual OAuth/mobile proofs are
DEFERRED, not covered by the mocked source tests.

Validation: `npm.cmd test` **123 passed**; `npm.cmd run lint`, `npm.cmd run
typecheck`, `npm.cmd run build` and `git diff --check` passed. The existing
001-007 fingerprint manifest passes unchanged. 008 SHA256 remains
`BD4397144C207C8271F8146F582F6B9ECA0E2BB8BC9739F7284B24D87E8ACD55`.

Files changed in this implementation (pre-existing unrelated work retained):

- `supabase/migrations/202609280009_google_basic_access.sql` (new draft)
- `src/lib/auth.ts`, `src/lib/capabilities.ts`, `src/lib/auth-form.ts`
- `src/config/navigation.ts`
- `src/app/auth/actions.ts`, `src/app/auth/form-actions.ts`, `src/app/auth/callback/route.ts`
- `src/app/login/page.tsx`, `src/app/pending-approval/page.tsx`
- `src/app/dashboard/page.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/help/page.tsx`
- `src/app/dashboard/users/page.tsx`
- `src/app/dashboard/settings/actions.ts`, `src/app/dashboard/settings/page.tsx`, `src/app/dashboard/settings/security/page.tsx`
- `src/components/auth/google-login.tsx`
- `src/components/dashboard/navigation.tsx`, `src/components/dashboard/ui.tsx`
- `tests/foundation.test.mjs`
- `docs/GOOGLE-FIRST-AUTH-AUDIT.md`, `docs/GOOGLE-FIRST-IMPLEMENTATION.md`

## Migration decision

Use **009**, following 008. 008 hardens the previous admission/security model and
has retained disposable evidence. 009 introduces a separate product policy:
active NULL-role membership, Google-first admission and Super-Admin-only role
assignment. 001-007 and 008 are unchanged by this task. Deploying application
source alone will not enable new admission: reviewed 008 and 009 must be applied
in order in a separately authorized release after disposable validation.

009 drops the old active-requires-role constraint forward, retaining enum values,
the unique school/user key and all 008 serialization/count/last-SA protections.
No existing membership is backfilled or reactivated. Missing 008 prerequisites
abort the transaction. No seed, reset, object deletion or credential system.

## Admission and authority

The existing Auth user-insert trigger becomes a deferred constraint trigger. At
transaction completion it reads Auth-owned `auth.identities`, ensuring identity
creation can finish before provider classification. A newly inserted user with
Google identity and no non-Google identity receives active + NULL; other new
users retain pending + NULL. Browser-controlled metadata supplies only a display
name, never admission or a role. No service-key client or callable admission RPC.

Both profile and membership use conflict-do-nothing. Existing memberships remain
exactly unchanged, including roles, status and approval timestamps. Normal repeat
login and identity linking for an existing user do not insert an Auth user and
therefore do not schedule admission. There is no repair/backfill on login. A
missing or inactive default school aborts new admission; existing users with no
membership remain fail-closed. This also deliberately fails closed for fallback
signup when the default school is unavailable.

Runtime release gate: prove the deployed Auth version creates user and Google
identity in the same transaction and that deferred trigger timing works with
Auth's database role. If not, STOP and redesign; do not compensate by trusting
`flow=google`, editable metadata, or activating pending accounts. Triggers on
Auth tables can prevent signup if they fail; this must be tested before release.

## Capability and RLS review

Basic access is `status=active, role=NULL`, internally account state `basic`, UI
label `Akses Dasar`. It is never an `orang_tua` alias. Its exact capability list
is dashboard.read, profile.read, profile.update_self and school.read. Help/about,
settings and logout use these account capabilities. Role privileges remain an
explicit separate matrix. Suspended/rejected/pending states remain blocked.

| Surface | Basic access / database boundary |
| --- | --- |
| Schools | Read own active school's existing organizational profile/contact fields via member RLS; no edit. These are treated as safe school identity, not sensitive business data. |
| Profiles | Own profile read and allowed name/phone/timestamp update under 008; no other profiles, role or identity editing. |
| Memberships | Own membership read; browser INSERT/DELETE remain revoked; admin reads remain role-based. |
| Academic years, semesters, classrooms | 003 role-based policies deny NULL. No academic queries/widgets for basic dashboard. |
| Feedback | New restrictive `009 feedback requires assigned role` intersects all existing permissive policies for every authenticated operation. NULL denied, including previously owned feedback. |
| Audit | 007 role-based read and trigger-only write unchanged; NULL denied. |
| Storage | 008 scope/owner/delete policies retained. `can_read_own_avatar` additionally requires an assigned active role. NULL denied even own avatars; business buckets and all writes remain denied. |
| RPCs | Academic activation remains invoker with role checks and RLS; explicit PUBLIC/anon EXECUTE revoke, authenticated grant retained. Trigger functions remain non-callable. |
| Membership role changes | New 009 BEFORE UPDATE trigger requires same-school active SA whenever role changes. 008 obtains serialization row first and enforces last-SA invariant afterward. Kepala cannot assign any role, including NULL-to-Guru. |

Normal application membership management is SA-only. Kepala keeps read access but
no editing controls. Existing SQL authority to change non-SA status without
changing role is not expanded; 009 specifically restricts role changes. Direct
role changes with no authenticated SA principal also fail; privileged maintenance
must use a separately reviewed process. Initial Auth insertion always has NULL
role, while existing 008 INSERT grants remain revoked from browser roles.

## UI, passwords and errors

Google is the first primary login CTA, one flow for signup and login. Email/password
is secondary. Basic users immediately land on the account dashboard, with identity,
school, access label and SA assignment explanation. Feedback, academic, audit,
notifications and administration links/widgets are not presented to basic users.

Account Settings offers **Atur Kata Sandi**, new password plus confirmation only.
The server validates both and calls normal authenticated `auth.updateUser({password})`.
No provider-list inference of password existence, custom credential table, password
history or password onboarding. Auth policy failures remain safe errors with a
relogin/recovery path; no provider security setting is weakened. Password inputs
are never written to application tables or logs.

Invalid credentials and Auth-reported email-not-confirmed have distinct safe
messages; unknown failures do not assert email verification as their cause. OAuth
cancellation/provider failure differs from callback/session completion failure.
Pending/rejected/suspended continue to use authoritative account-state pages.

## Required disposable proofs before release

Retain F1.5 evidence but do not treat it as proof of 009. Apply reviewed 009 only
to the owned disposable when separately authorized. Test actual fresh Google
Auth provisioning/transaction timing, repeat/link flows, conflict preservation,
missing/inactive school rollback, every basic-access table/RPC/Storage boundary
using normal roles, SA role assignment and kepala direct SQL denial. Repeat
affected last-SA sequential/concurrency checks because a new membership trigger
and NULL-role population are introduced. Verify signup and password operations
under actual Auth settings. Catalog presence alone is not behavioral proof.

## Post-push/mobile checklist (not executed; no push/deploy authorized)

1. Brand-new Google account: profile and default-school active NULL membership.
2. Repeat Google login: existing membership and role unchanged.
3. Akses Dasar dashboard: identity, school, minimal menus, no password prompt.
4. Direct privileged URLs: forbidden; direct API/RPC/Storage also denied.
5. Super Admin assigns Guru without changing tenant identity.
6. Relogin/refresh: Guru permissions and menus, no old basic-access cache.
7. Kepala cannot assign/change roles via UI, action or direct database request.
8. Suspended Google account remains suspended.
9. Rejected account remains rejected; pending also remains pending.
10. No duplicate profile/membership; test repeat/concurrent completion.
11. Atur Kata Sandi: mismatch rejected, matching password accepted by Auth.
12. Email/password fallback works after setting a password.
13. Google login still works after password setup.
14. Android Chrome: OAuth return, cookies, menu, settings and logout.
15. Desktop browser: repeat the same flows and safe failure states.

References: [Supabase identities](https://supabase.com/docs/guides/auth/identities),
[identity linking/password setup](https://supabase.com/docs/guides/auth/auth-identity-linking),
[Auth database triggers](https://supabase.com/docs/guides/auth/managing-user-data).
