# Production readiness audit — 2026-09-24

## Status and evidence

Repository `AlwisGinting/APLIKASI-MANAGEMENT-SEKOLAH`, local branch `main`, HEAD `f64bc34` (`feat: finalize audit trail and data integrity foundation`); initial working tree clean. Remote HEAD and Vercel deployment SHA were not independently verified. Owner confirms migrations 001–007 applied in production. They are immutable; historical REVIEW ONLY comments are not instructions to rerun them. No SQL, seed, commit, push, deploy, authenticated production mutation, or environment-file inspection was performed.

Conclusion: foundation is ready for controlled authenticated smoke testing, not certified production-ready for sensitive operational documents. Source review, mocked tests and anonymous HTTP checks do not prove live RLS, SMTP or restore readiness. Stage C design is prepared in [STORAGE.md](STORAGE.md); hardening is not deployed. No migration 008 was created: this stage prepares the design, while live inventory and disposable policy tests remain prerequisites to an implementation migration.

## Findings and changes

| Priority | Finding | Disposition |
|---|---|---|
| High, before sensitive uploads | Storage migration 002 grants every active tenant member SELECT/INSERT/UPDATE/DELETE, without bucket/owner/role restrictions. A browser can call Storage directly even though the UI has no upload control. UPDATE can relocate an object between tenants where the caller belongs to both. | Documented blocking gap; proposed policy model in STORAGE.md. Existing sensitive objects, if any, require immediate owner review. No claim the proposed restrictions are live. |
| Medium | Academic year/semester saves forced is_active=false before a separate activation RPC. Failure of that RPC left an existing active record inactive; success emitted unnecessary deactivation/reactivation audit events. | Fixed: checked edits leave activation untouched in the update payload; activation still goes through the existing RPC. Explicit uncheck and new records still use false. Two stateful regression cases cover RPC failure and explicit deactivation. |
| Medium | Last-super-admin and self-edit protection are application-only; direct database requests and concurrency can bypass those guards. | Existing policy limitation, unchanged. A dedicated database invariant requires a separately reviewed migration and concurrency tests. |
| Medium | Application excludes inactive schools, but existing database membership helpers do not check schools.is_active. | Direct API access by an otherwise active membership can remain possible. Define school suspension semantics before relying on that flag as revocation. |
| Medium | Browser tenant selection is shared across tabs. | Server revalidates membership and tenant, but a stale create form may submit into the newly selected tenant. Test and communicate current tenant; future expected-context guards must validate against authenticated context. |
| Low | Documentation still described migration 007 as unapplied. | Added authoritative dated status above historical records, preserving migration files. |
| Test tooling | Windows core.autocrlf=true caused checksum and SQL branch parsing failures. | Normalize CRLF in memory for canonical checksum comparison and accept either newline in branch parsing. Existing checksum manifest unchanged. |

The academic fix does not make save + activation one transaction. Details may be committed when activation fails; reread before retry. Fully atomic save/activate would require a future database RPC. Moving an active semester into another year with an active semester can fail its unique constraint safely; it must not bypass the invariant.

## Smoke matrix

All authenticated rows below are source-reviewed and require the manual result to be recorded. Use synthetic fixtures in an isolated environment for mutation/negative testing, not production SQL or seeds.

| Area | Source evidence / expected behavior | Remaining smoke test |
|---|---|---|
| Authentication/login | Server form validation, SSR signInWithPassword; generic credential errors; redirect outside catch | Verified active user enters; pending/rejected/suspended cannot enter; incorrect password generic; email delivery/verification |
| Tenant context | getUser, owned active membership, known role, active school; cookie only selects validated options | Two schools with different roles; foreign/stale cookie; suspension during session; stale tabs |
| Academic context | Year scoped by school; semester scoped by school + year; parents do not query academics | No active year, no semester, valid selection, switching tenant |
| Dashboard | Dynamic authenticated layout and capability-dependent links; generic error boundaries | Five roles, empty state, backend error/retry, mobile/keyboard |
| User management | Admin capability and tenant query; Auth admin email lookup only for IDs obtained from that query; unavailable lookup graceful | Approve/reject/suspend/role change; foreign ID; self/last-admin UI guard; direct RLS separately |
| School settings | Server tenant ID and allowlisted fields; RLS/grants from 006 | Admin save, non-admin read-only, unknown/immutable fields rejected |
| Master academic data | Tenant filters, related-year checks, zero-row rejection; database constraints and activation RPC | Create/edit/delete and dependencies; operator cannot delete; guru read-only; failed activation preserves prior active state |
| Feedback | Server actor/tenant; own feedback vs admin access; status-only mutation | Create and status change; foreign ID; content/actor tampering; safe current_path |
| Activity/audit | Admin-only tenant query, latest 50 with deterministic ordering, safe formatter and profile fallback | Event matrix below, actual RLS, empty vs unavailable vs service failure |
| Logout | Sidebar uses local logout; explicit global action requires confirmation | Back/refresh requires login; test local vs global separately; already-issued access tokens have expiry limitations |
| Password recovery | PKCE SDK PASSWORD_RECOVERY event; short-lived marker bound to getUser; marker is UX, not an authorization credential | Actual email, same-browser exchange, expired/reused code, changed next, reset and subsequent login |
| Redirects | Origin matched to request host; safe internal next rejects external/encoded bypasses | Owner verifies exact Supabase allowed local + production callbacks and trusted hosting proxy behavior; cookie separation |
| Health | GET returns only status:ok and no-store; independent of auth proxy | Liveness only: does not certify Supabase/database/Storage availability |

Anonymous production GET checks on 2026-09-24 (redirects followed, no login):

- `/api/health`: HTTP 200, body `{"status":"ok"}`, Cache-Control `no-store`.
- `/login`: HTTP 200, private/no-store.
- `/dashboard`: final HTTP 200 at `/login`.
- `/auth/callback` without code: final HTTP 200 at `/login?error=verification`.

No authenticated browser session, SMTP delivery, live schema inspection or production data mutation was used. These checks do not establish the deployment's commit SHA.

## Migration 007 integration

| Event family | Trigger and UI integration |
|---|---|
| profile.updated | AFTER UPDATE; only full_name/phone/avatar_path field names; fans out to subject's active memberships, no private values |
| school.updated | AFTER UPDATE; tenant is school row ID; allowlisted changed fields |
| membership | UPDATE only: approved/rejected/suspended/updated and role_changed; simultaneous status+role creates two disjoint events; no membership-created/deleted history promised |
| academic year / semester | INSERT/UPDATE/DELETE; activated/deactivated on flag change; default semester and activation fanout participate in triggers |
| classroom | created/updated/deleted; activation changes appear as updated |
| feedback | created/status_changed/deleted; no message/title payload in audit metadata |

Source transaction and audit inserts share a database transaction; trigger failures propagate. Timestamp-only updates do not create events. Actor/time are DB-stamped; row identity/tenant rewrites rejected. SELECT is authenticated admin + tenant RLS; application INSERT/UPDATE/DELETE/TRUNCATE prohibited. Owner/service privileges are outside this protection; not tamper-proof against DB administrators.

`src/lib/audit.ts` independently requires audit.read, filters the server tenant, bounds 50 rows and uses normal authenticated client. Operator/guru/orang_tua get account summaries, not tenant administrative audit. Missing-relation/schema-cache errors show unavailable; other failures use a generic error, not an empty success. Since 007 is applied, unavailable should now be investigated as schema/deployment drift. Actor names can be unavailable after deletion/membership changes. Formatter allowlists action/entity/field/enum values; React escapes labels.

Cross-tenant isolation is supported by source RLS and server filters, but requires ordinary-user direct API checks on disposable two-tenant fixtures. Profile changes are intentionally global and emit field names in each active subject tenant. Audit stores no login/password history and performs no backfill.

## Validation

Node was absent from PATH and node_modules absent. Downloaded portable Node 22.16.0 into OS temporary storage, verified its official SHA256, installed lockfile dependencies using npm ci --ignore-scripts. No runtime/dependency manifest changes. Read installed Next 16.3.4 mutation and revalidation guides before source edits.

- npm test: 72 passed, 0 failed, 0 skipped (70 existing + 2 regression cases). Static/mock tests, not SQL runtime proof.
- npm run typecheck: passed.
- npm run build: passed, default Turbopack production build, 25/25 static generation steps.
- npm run lint: passed (exit 0).
- git diff --check: passed (exit 0); Git emitted only core.autocrlf conversion notices.
- Live database/RLS, Storage operations and restore tests: not run.

## Manual gates and limits

1. Review this diff. Confirm deployed SHA separately; local work is not deployed.
2. Run authenticated browser smoke matrix with owner-controlled test accounts; verify email delivery, callback allowlist, recovery and logout.
3. On disposable database with 001–007, verify five roles/two tenants, audit append-only privileges, rollback, no-op/status+role events, positive controls and direct API attempts. Existing opt-in integration harness is incomplete for mutation/007/Storage; do not interpret mock pass counts as RLS proof.
4. Inventory live buckets, all permissive/restrictive policies and object paths through owner-controlled review. Design below must precede sensitive document use; disabling an upload UI is insufficient.
5. Implement/review a new 008+ only after that inventory, then run disposable Storage negative tests. Never rerun 001–007.
6. Configure Drive owner consent and secure secret storage only when implementing integration. No connection, OAuth credentials, folder creation, backup schedule or export was performed here.
7. Approve retention and recovery objectives, perform first encrypted database + binary backup and isolated restore drill. Stage C is not operationally complete until those gates pass.

## Changed files

- src/app/dashboard/master/actions.ts — preserve activation during checked edits.
- tests/foundation.test.mjs — two behavioral regressions, CRLF-safe static parsing/checksums.
- docs/READINESS-2026-09-24.md — audit evidence, findings, validation and manual gates.
- docs/STORAGE.md — proposed Stage C RLS/path/lifecycle/Drive/backup architecture.
- docs/ARCHITECTURE.md, docs/BACKUP.md, docs/DATABASE.md, docs/PRODUCTION.md, docs/SECURITY.md — authoritative applied-007 status and links above historical records.

Final comparison: all files under supabase/migrations and package.json/package-lock.json unchanged against HEAD. No migration 008 SQL exists to review. Ignored node_modules/build artifacts are local validation outputs, not source changes.
