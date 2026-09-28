# Google-first authentication: corrected requirements and source audit

Historical audit; implementation now tracked in [GOOGLE-FIRST-IMPLEMENTATION.md](GOOGLE-FIRST-IMPLEMENTATION.md).
The findings below describe the pre-implementation source. No production changes. Migrations 001-007 remain immutable;
migration 008 is not applied to production. This requirement supersedes any
proposal requiring password onboarding after Google login.

## Required account flow

First Google sign-in succeeds through Supabase OAuth/PKCE, provisions the profile,
and admits the new user to the active default school with membership status
`active` and role `NULL`. The UI calls this state **Akses Dasar** and immediately
opens a minimal dashboard. No password setup page or password prerequisite.

Google is the primary authentication method; email/password remains a fallback.
Akses Dasar is an access state, not a new role and not an alias for `orang_tua`.
Only Super Admin assigns the eventual role. OAuth identity, email, user metadata,
URL hints and browser state must never grant a privileged role.

## Findings in the current repository

| Surface | Existing behavior | Required change |
| --- | --- | --- |
| `src/app/auth/callback/route.ts` | PKCE exchange followed by account-state routing; no password onboarding | Preserve verifier/session checks; allow the validated basic-access account state |
| Migration 002 `handle_new_user()` | Profile plus default-school `pending`, NULL-role membership | Reviewed forward migration for new Google admission; never rewrite 002 |
| Migration 002 `active_membership_requires_role` | Rejects `active` with NULL role | Explicit forward schema change before enabling the new application model |
| `src/lib/auth.ts` | Tenant options require a non-null recognized role | Accept active NULL-role membership only as the distinct basic-access state in an active school |
| `src/lib/capabilities.ts` | All capabilities reject NULL role | Explicit minimal allowlist, separate from every role, with all other capabilities denied |
| Dashboard | Shows academic period and unconditional feedback/help links | Minimal account dashboard and links limited to the basic-access allowlist |
| Account security settings | Requires current password and calls Supabase `updateUser` | Optional password management labelled `Atur Kata Sandi`; do not infer password presence from provider lists |
| Membership administration | Existing admin workflows include kepala sekolah | Reconcile application and database role-assignment rules with the new Super-Admin-only requirement |

There is no mandatory Google password-onboarding step in the inspected source to
remove. Removing a redirect alone would not implement the new account model.

## Security consequences requiring implementation and focused proofs

The proposed minimal allowlist is dashboard, own profile and account settings.
Academic data, user administration, System Center, audit, feedback and Storage
access must not become available merely because a NULL-role member is active.
Review direct database access as well as navigation: existing member-based RLS
helpers and policies can grant more than the application capability map. In
particular, feedback policies and draft 008 avatar policy use active membership.
Enabling active NULL-role memberships without that review risks unintended access.

Provisioning must rely on Auth-controlled provider identity, not editable user
metadata or the callback's `flow=google` display hint. Review Auth user/identity
creation timing before choosing the database trigger or supported server flow.
Existing pending, rejected or suspended accounts must not be silently activated
when they sign in with or link Google. Existing roles must never be overwritten.
Repeated callbacks must be idempotent and missing/inactive default schools must
fail closed. Email/password signup admission is not implicitly changed by this
Google-first requirement.

Password management must use supported Supabase Auth APIs, including any required
reauthentication or recovery. `updateUser({ password })` supports setting a password
for an authenticated user. Do not weaken provider security settings to make it
succeed. If current-password/reauthentication policy requires additional proof,
handle that through supported Auth flows. Do not treat `identities`, provider
lists, or a custom application boolean as authoritative password-presence evidence.
Never inspect credential hashes, write passwords to application tables, or log
passwords. Confirmation must match and failures must use safe user-facing messages.

References:
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security)

## Validation scope for the subsequent implementation

- Fresh Google user: one profile, one active NULL-role default-school membership,
  immediate minimal dashboard, no password prerequisite.
- Repeat callback/linking: no duplicate admission, role overwrite or reactivation
  of pending/rejected/suspended accounts.
- Akses Dasar: explicit permitted account operations; denied privileged routes,
  RPCs, cross-tenant data, feedback and Storage unless separately approved.
- Super Admin role assignment: positive control; kepala/non-admin denial; normal
  role authorization after assignment. Retest affected membership invariants.
- Optional password setup/update through Auth, confirmation and safe failure;
  Google login still works and email/password fallback works after setup.
- Preserve recovery/PKCE and active-school checks. Run required general checks
  after implementation. Retain unaffected F1.5 evidence; do not claim prior proofs
  cover the new NULL-role admission model.

No migration, application behavior, provider configuration or production data was
changed by this audit. Implementing this model requires coordinated reviewed
forward SQL, application guards/UI and targeted disposable runtime tests.
