# Disposable integration acceptance — design only

**008 DRAFT / NOT APPLIED. This plan has not been executed.** No runnable production SQL or provisioning automation is introduced. Existing localhost read-only harness is insufficient for this plan. Apply reviewed 001–008 only in a separately authorized disposable Supabase environment, never production.

## Harness boundaries and fixtures

- Future mutation harness must default OFF, require explicit opt-in and an exact loopback HTTP origin; reject remote/project production hosts before creating any client. No dotenv, secret logging or token storage in repository/browser. Provisioning uses an isolated owner process; assertions use anon/ordinary-user sessions, never service-role RLS bypass.
- Use real Supabase Auth/Storage locally. Two active schools A/B and one inactive C, real data in each with a B positive-control user. Roles/states per school: anonymous; authenticated no membership; pending; rejected; suspended; orang_tua; guru; operator; kepala_sekolah; super_admin. Include dual-school users with different roles and two independent SAs of A.
- Seed private bucket binaries using the supported Storage API *before* hardening in isolated setup: canonical owned avatars for A/B, another user's avatar, null-owner and malformed legacy paths, and business documents. Do not simulate upload by directly writing storage.objects metadata.
- Create a third independent authorized requester for concurrency tests where possible; also test each SA self-demoting concurrently. Fresh fixture set per case; capture only assertion IDs, outcomes and SQLSTATE, never session credentials or file contents.

## Matrix

For each identity above, test S/I/U/D on schools, profiles, memberships, years, semesters, classrooms, feedbacks, audit_logs, and each Storage bucket. Repeat own A, foreign B, inactive C, dual A/B role, and revoked/suspended current membership. Use actual positive rows/objects so an empty result cannot fake isolation.

- Anon: no private rows/files or mutations. No membership/pending/rejected/suspended: own profile/membership SELECT only; profile UPDATE denied; no direct membership INSERT, Storage, admin or academic mutations.
- Active parents: own profile edit, school read, own feedback create/read; no academic/admin/audit/file-other-owner access. Guru adds academic read; operator adds academic create/update and activation, not delete or custom semester names.
- KS: foundation admin permissions but never grant SA or update any SA membership. SA: same-school SA management subject to nonzero invariant. No global role.
- Same owned canonical avatar SELECT: allow only active school/member. Other user/tenant, null owner, arbitrary bucket, subject mismatch, missing segments, upper-case UUID, empty segment, bad UUID, slash/backslash/traversal/encoded separator, wrong extension and noncanonical version: deny safely, no cast exception.
- INSERT/UPDATE/DELETE/upsert/move/copy remain denied for all application roles in all buckets. Test A→B move even with active memberships in both. Three business buckets deny read too. Verify anonymous no grant and service bypass is never used in assertions.

## A–H invariant cases

| Case | Mutation | Assert after commit/rollback |
|---|---|---|
| A | SA demotes one of 2 active SAs | Allowed; real count and private count both 1 |
| B | Demote only active SA | P8001/denied; all rows/counter/audit unchanged |
| C | Suspend only active SA | Same |
| D | Change only SA to kepala | Same |
| E | SA promotes operator | Allowed; both counts increase exactly once |
| F | Kepala promotes operator or reactivates suspended SA | P8002/denied; no elevation/event |
| G | Concurrent removal of two distinct SAs | Cannot commit zero; loser denied/serialization-aborted |
| H | A-SA targets B membership without B authority | Denied/zero rows, no B audit/counter change |

For G use **two database connections/transactions**, not JS Promise.all against a mocked store. Run READ COMMITTED, REPEATABLE READ and SERIALIZABLE. In T1 update one SA without committing; start T2 removal of the other, verify waiting or safe failure, commit T1, then finish T2. For stronger-isolation runs establish both snapshots before T1's write. Assert actual committed count >=1 AND materialized count equals actual. Repeat rollback T1, reversed ordering, actor revoked while waiting, self-demotion, multi-row UPDATE, and target changing between lookup/update. Safe deadlock/serialization failure is acceptable; silent stale success is not. Retry the complete transaction after reread, never just replay an old mutation blindly.

## Mutation-path and trigger coexistence cases

- Direct REST update bypassing UI must enforce the same hierarchy; forged approved_by/approved_at/timestamps are replaced/preserved by DB.
- Ordinary DELETE and TRUNCATE membership denied by grants/policies. In a separate trusted test harness exercise actual DELETE/cascade last-SA path: invariant still aborts source deletion, including profile/Auth cascade. No trigger disabling.
- Trusted zero-SA bootstrap allowed only through reviewed operator context; first grant count 0→1. Normal KS cannot bootstrap. Zero-SA legacy tenants and existing memberships are not rewritten by migration.
- INSERT ON CONFLICT DO NOTHING must not increment; ON CONFLICT DO UPDATE increments/decrements only once from the actual update. Rollback/constraint failure/audit failure must roll back counter and source. These tests are essential because BEFORE INSERT can run on a conflict.
- Password/Google new-user trigger each creates one own profile plus pending/NULL membership in the intended active default school. Repeat-email/conflict does not drift counter. Inactive/missing default school gives no automatic membership. Privileged OAuth metadata never grants role.
- Profile own edit requires any active school; full_name/phone limits and normalization; supplied updated_at overridden; id/created_at/avatar_path write denied. Existing profile creation and pending account-state reads remain valid.
- Semester default trigger still inserts Ganjil/Genap for permitted academic create. Operator/KS INSERT custom name denied; SA custom allowed; existing UPDATE name guard stays. Inactive school rejects CRUD and both activation RPCs. Verify their invoker status and trigger-only helper EXECUTE denial.
- Audit INSERT/UPDATE/DELETE/TRUNCATE browser denial, exact UPDATE role/status events, simultaneous two events, source rollback on audit failure, inactive school audit read denied. Confirm no accidental generic audit API.
- Owner checks: helper owners can bypass source RLS without recursion; fixed search_path; only required EXECUTE. app_private inaccessible through ordinary roles/REST. Check actual table and column grants including inherited/default grants.

## Migration/release acceptance

1. Review the draft; never execute from the default unit-test command.
2. Unknown Storage policy or public/missing bucket must abort atomically and preserve old policy/data state. No automatic bucket fixes.
3. Authorized disposable apply/reapply must preserve every legacy object key/hash and membership data, rebuild correct counters, leave exactly the three reviewed Storage policies, and retain 001–007 fingerprints.
4. After source deployment, render users page for KS/SA: KS has no SA option/actions; SA permitted operations work; last-SA failure and concurrency errors are safe. Recheck fresh user/tenant state after self-change.
5. Record actual results and remaining failures. Until all pass, SQL semantics/concurrency are unverified. No production rollout approval is implied by unit tests.
