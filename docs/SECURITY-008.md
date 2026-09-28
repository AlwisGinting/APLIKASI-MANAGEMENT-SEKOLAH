# F1 security contract — 2026-09-27

**MIGRATION 008 IS DRAFT / NOT APPLIED.** Baseline `db35aac`; 001–007 are applied per owner and immutable. No SQL, provider configuration, deployment, or Storage object mutation was performed. Source/unit/static validation is not live database enforcement. Draft: `supabase/migrations/202609270008_security_storage_hardening.sql`.

## Scope and release order

H1–H4 and M1–M3 are addressed in the proposed database contract. The application immediately rejects principal-to-SA elevation, but its count check is only a UX precheck. Do not treat application deployment alone as remediation. Review the SQL and live policy/owner/grant/bucket inventory, run the approved migration on a disposable Supabase project in a separately authorized task, pass the integration design in `tests/integration/SECURITY-008.md`, then schedule owner-controlled production application and source deployment. No migration is run in this task.

Migration is one transaction with bounded lock/statement waits. Unknown Storage policies or any missing/public expected bucket abort the whole transaction. It deliberately does not create/fix buckets or change MIME/size configuration. Repeat application recreates named policies/triggers and rebuilds the private count under source-table locks; partial application rolls back. This is not a general schema repair tool: unexpected existing private objects, owners, grants or dependencies require inspection, not blind retry. Acquire a reviewed backup/restore point and avoid competing DDL. Timeout/deadlock means rollback and operator review, never disabling guards.

## H2/H4: role hierarchy and serialized invariant

`users.manage_super_admin` derives from the existing capability map and permits only active SA. Server context additionally requires the current active school. Action and UI block all changes to an SA membership by kepala, including status reactivation/suspension and demotion. Kepala retains management of non-SA memberships. SA may manage another SA or its own SA membership subject to the invariant; ordinary self-administration remains blocked. Target ID is filtered by current tenant. Safe error mappings use SQLSTATE only (`P8001`, `P8002`, `40001`, `40P01`); raw errors are never returned.

Private `app_private.school_admin_state` holds one row per school: active-SA count and revision. It has no application schema/table privileges, has RLS and no policies, and is not an exposed application API. This one table is necessary for a shared *write conflict*, not a business-file table. Trusted function/table ownership and absence of unexpected inherited privileges must be verified before execution.

1. Lock membership/school source tables while initializing counts from actual data. Existing zero-SA schools remain zero; no role bootstrap or data repair is invented.
2. Every membership INSERT/UPDATE/DELETE has a BEFORE guard that writes the same school's revision row and retains its transaction lock. New schools initialize a zero row on first insert. UPDATE/DELETE with missing guard state fail closed. Identity cannot change.
3. After serialization, derive actor from `auth.uid()` and read current same-school active membership and active school. For UPDATE/DELETE require SA/KS; if OLD or NEW role is SA require SA. INSERT admission has no browser grant. Trusted Auth inserts pending/NULL-role; no arbitrary actor/tenant argument is accepted by these trigger functions.
4. AFTER successful row mutation, apply the actual old/new active-SA delta. A decrement to zero is rejected with `P8001` and rolls back source, counter and audit. Counting AFTER is essential for INSERT ON CONFLICT DO NOTHING and DO UPDATE: an attempted insert must not double-count.
5. READ COMMITTED serializes on the actual counter-row update. REPEATABLE READ/SERIALIZABLE conflict on that same physical write and may abort with serialization failure. Unlike advisory-lock + snapshot-count alone, a waiting transaction cannot commit a removal based only on its old count. Retry requires rereading/re-authorizing the whole transaction. Deadlock victims roll back; bulk mutations across tenants may need ordered locking in a future API.

The invariant conservatively also preserves the last SA in an inactive school; ordinary mutations there are already denied. Same-school role/status changes, direct REST writes, multi-row writes and membership DELETE/cascade paths encounter the triggers. Browser DELETE/TRUNCATE are revoked, with no DELETE policy. Privileged maintenance, trigger disabling, owner DDL/TRUNCATE and database restores are outside the normal application security boundary: restore/rebuild counts while source writes are locked, validate counts before reopening traffic, and never silently bypass the guard. The private FK also restricts school deletion; there is no ordinary school-delete feature.

Auth signup/owner maintenance can have NULL `auth.uid()`. That is not a user escape hatch: anonymous has no mutation authority, and authenticated grants/RLS deny unprincipaled writes. Only trusted maintenance can bootstrap the first SA of a zero-SA school; no user RPC is added. Existing 007 audit still records UPDATE role/status changes transactionally. No new generic audit writer is introduced.

| Case | Expected database contract |
|---|---|
| A: 2 active SAs, SA demotes one | Allow; count 2→1 |
| B: only SA demoted | Deny and rollback |
| C: only SA suspended | Deny and rollback |
| D: only SA changed to kepala | Deny and rollback |
| E: SA promotes operator to SA | Allow; count increases |
| F: kepala promotes operator to SA | Deny before mutation commits |
| G: two transactions remove different SAs | At most one commits; second denied or aborted, never zero |
| H: SA of A changes B without B authority | Deny; A role never authorizes B |

These are design expectations; the migration and concurrency cases have **not** been executed.

## H3: active-school helpers and dependent paths

`is_school_member(uuid)` and `has_school_role(uuid, app_role[])` require the caller's active membership joined to an active school. They are stable, fixed `pg_catalog` search_path, fully qualified, and have EXECUTE only for authenticated plus trusted existing owners. SECURITY DEFINER is retained specifically to avoid recursive policies on schools/memberships, not to bypass user mutation RLS. Owners must be trusted and able to read those tables without recursive RLS. No FORCE RLS or caller-supplied principal is introduced.

| Dependent path | Result of replacement |
|---|---|
| schools SELECT and profile-school UPDATE | Inactive tenant denied |
| memberships admin SELECT/UPDATE | Inactive tenant denied; own membership SELECT remains for account-state UX |
| profiles admin SELECT | Active school required; own SELECT remains for account-state UX |
| years/semesters/classrooms CRUD | Role + active school via existing policies |
| activate_academic_year/activate_semester | Invoker RPC, source RLS and helper checks; fixed catalog search_path |
| semester name guards | Same-school SA for custom names; INSERT gap closed |
| feedback SELECT/INSERT/UPDATE/DELETE | Existing own/admin rules now include active school |
| audit SELECT | Active SA/KS of active school only |
| avatar SELECT | Owner + canonical path + current active membership/school |

Default-semester definers retain their narrow trigger purpose and revoked browser EXECUTE, with catalog search_path. `handle_new_user` keeps its existing body and default active-school/pending logic; only search_path/EXECUTE are hardened. 007 audit capture already uses catalog and revoked EXECUTE. Its global-profile fanout still records field-name history for subject memberships; writing history does not grant inactive-school read access. No auth metadata is used for role assignment.

## M1–M3 and deferred medium findings

- **M1 fixed in draft:** remove pending-membership INSERT policy and table/column INSERT privileges. Existing default-school Auth trigger is the only current admission flow. No self-service school joining, invitation tables or new membership RPC. Existing rows remain intact. Future legitimate admissions require separate review.
- **M2 fixed in draft:** add INSERT guard for Ganjil/Genap versus same-school SA custom names. Existing 004 UPDATE-name protection stays. Default-semester creation remains valid.
- **M3 fixed in draft:** profile writes require own identity and at least one active-school membership. Grant only full_name/phone/updated_at; the last field is retained for action compatibility but always database-stamped. Identity, created_at and avatar_path cannot be written by normal clients. Normalize/validate edited name/phone without a backfill; signup creation remains untouched. A preexisting invalid name/phone must be corrected on the next profile edit.
- **M4 deferred:** stale multi-tab form tenant binding affects all mutation forms; requires a separate context/replay contract and browser tests. Current tenant scoping remains fail-closed for foreign targets, but new feedback can still follow the current cookie's authorized school.
- **M5 deferred:** transactional save+activate requires domain RPC/workflow changes beyond access hardening. Existing partial-save caveat remains.
- **M6 deferred:** server pagination/query/UI contract is F4 Data Engine, not an authorization migration.

## H1: complete Storage policy replacement

Old policies explicitly dropped (both historical and current names):

1. `tenant members can read private files`
2. `tenant members can upload private files`
3. `tenant members can update private files`
4. `tenant members can delete private files`
5. `active tenant members can read private files`
6. `active tenant members can upload private files`
7. `active tenant members can update private files`
8. `active tenant members can delete private files`

The obsolete cast-based `storage_school_id(text)` loses PUBLIC/anon/authenticated EXECUTE. The three new names are dropped/recreated for repeatability:

| New policy | Role/type/operation | Bucket and USING | WITH CHECK |
|---|---|---|---|
| `008 storage scope gate` | authenticated, restrictive ALL | Exact avatars; stored owner_id = UID, subject = UID, canonical path, current active membership + school | false: no INSERT/UPDATE, including upsert/move |
| `008 avatars owner read` | authenticated, permissive SELECT | Same exact avatar conditions | Not applicable |
| `008 storage delete deny` | authenticated, restrictive DELETE | false | Not applicable |

No anon policies. All three business buckets and all unknown buckets default-deny application users. No permissive write policy exists; the restrictive false write checks/delete barrier also prevent future permissive policies from silently opening writes. Trusted service/owner bypass remains outside the application boundary. Unknown preexisting policies cause preflight failure, not silent removal.

### Conservative avatar decision

This stage provides **read-only owner access**, not a new avatar upload feature. Key: `<school_uuid>/v1/<user_uuid>/<version_uuid>.<ext>`, canonical lowercase UUIDs, exact segments, jpg/jpeg/png/webp. A PL/pgSQL early return guards the UUID cast so malformed names deny without cast errors or SQL-function inlining. Path alone is insufficient: stored Storage owner_id must also match UID; null/legacy unowned objects deny. Membership role alone never permits reading another user's avatar. No admin-wide avatar browsing is invented.

No current application upload/download/signing module is added. Legacy keys/bytes are never renamed, moved, overwritten or deleted; noncanonical/unowned objects become inaccessible to normal clients pending a controlled inventory. Existing canonical owned avatars may remain owner-readable. Extensions do not establish actual MIME, byte safety or verification. Inventory must review content before any future inline rendering. Signed URLs minted earlier can outlive membership revocation until expiry; review outstanding URLs before enablement. Future signing must authorize using normal user RLS, never arbitrary privileged paths.

Future avatar upload requires a reviewed reservation/verification lifecycle, size limits (proposed 2 MB), detected JPEG/PNG/WebP decoding/re-encoding, immutable version keys, no SVG/HTML, and retry/reconciliation. It needs another migration and application work; 008 intentionally does not grant unverified upload permission.

### Future business metadata authority

No business file table is created now: there are no authoritative Student/Teacher/Attendance relationships yet. The only new table in 008 is the private SA invariant state. Business binaries remain disabled.

Before business files are enabled, PostgreSQL must own file identity, school, kind, validated subject relation, owner/creator, exact bucket/key and version, verified MIME/size/SHA256, status, created/verified/archive timestamps. Add retention/legal-hold/supersedes only when the lifecycle needs them. A bare subject_id UUID is not authorization: require real tenant-bound FK/relationship once that entity exists. Creator/time/hash/verification state cannot be caller-controlled. UNIQUE(bucket,key), immutable tenant/key, pending→available→archive/delete-pending lifecycle, reference checks, and Storage/DB reconciliation are required. Do not use global profiles.avatar_path as tenant file authority.

## Acceptance and operational risks

Unit/static tests cover the action/capability/SQL contracts, fingerprint 001–007, and unchanged password/Google pending flows. They do not prove SQL syntax, live grants, RLS recursion, trigger ordering or concurrent database behavior. No SQL runtime result is claimed. See the disposable integration plan before manual approval.

Remaining deployment gates: actual owner/default/inherited-grant review; exact policy and private-bucket inventory; supported Storage owner_id column; no unknown default privileges on app_private; signup/default-semester/audit coexistence; two-connection isolation tests; migration repeatability/rollback; legacy file access impact; backup including private guard state and safe reconciliation after restore. Do not run production SQL, change providers or deploy as part of this task.

References: [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [policy composition](https://www.postgresql.org/docs/current/sql-createpolicy.html), [Supabase Storage ownership](https://supabase.com/docs/guides/storage/security/ownership).
