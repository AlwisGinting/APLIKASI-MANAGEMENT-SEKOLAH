# Stage C — Storage hardening and backup/export design

Prepared 2026-09-24. Design only: no Storage policy/migration, upload module, metadata table, Drive OAuth integration or backup automation has been deployed. See [readiness audit](READINESS-2026-09-24.md). Migrations 001–007 are applied per owner and immutable.

## Existing versus proposed

Existing migration 002 creates private student-documents, teacher-documents, attendance-photos and avatars. Policies extract the first path segment as UUID and test active membership. They do not restrict bucket, owner, role, file shape, MIME or size. Malformed UUID paths can raise a cast error. No application Storage upload/download service or authoritative file metadata table exists. avatar_path/logo_path columns alone are not file authorization.

Proposed: retain private Supabase Storage as primary binary store and PostgreSQL as authoritative metadata/data store. Deny sensitive business buckets to application users until their entity relationships and permissions exist. Do not create student/teacher tables now. First enable only a separately tested avatar flow; school logos need a distinct reviewed path/permission rule, never generic avatar privileges.

## Canonical object names

`<school_uuid>/v1/<kind>/<subject_uuid>/<file_uuid>/<version_uuid>.<ext>`

- avatars: kind=users, subject_uuid=authenticated user ID.
- student-documents/teacher-documents/attendance-photos: reserve kinds students/teachers/attendance; no upload permission until real entity ownership can be checked.
- Server derives school from validated active context, subject from authenticated user or an authorized DB relationship, and generates random file/version UUIDs. It validates extension against detected content, not browser MIME alone.
- Use canonical lowercase UUIDs, exact segment count and allowlisted extension/kind. Reject empty segments, traversal, slash/backslash encoding tricks, bad UUIDs and unknown versions without throwing. No personal names, email, NISN or NIK in paths.
- A path is a reference, never proof of authorization. RLS must independently bind its school segment to current authenticated membership and its subject to an allowed actor/entity. A browser-generated valid-looking UUID cannot substitute that relationship.
- Immutable object keys and versions. Forbid in-place overwrite/upsert, move and cross-tenant rename for application users; replacement creates a new key. UUID opacity is not an access control.

## Storage RLS contract to implement in 008+

All checks include exact bucket allowlist, valid canonical path, authenticated non-null UID, ACTIVE membership and active school. Use fail-closed parsing; helpers must have explicit schema references/search_path and minimum grants. Prefer invoker functions; any necessary definer helper needs owner/EXECUTE review. Never trust JWT user metadata for role or a browser school_id.

| Bucket/operation | Initial proposed policy |
|---|---|
| avatars SELECT | Active owner and matching verified available metadata only; pending/deleted/archived versions denied. Future shared-avatar visibility needs a separate explicit tenant rule |
| avatars INSERT | Active owner; subject=auth.uid(); canonical immutable key; database-controlled pending upload reservation matching bucket/path/tenant/actor |
| avatars UPDATE | Deny; no upsert or move |
| avatars DELETE | Active owner only for a DB-authorized delete_pending version that is not referenced or held; otherwise deny |
| three business buckets, all operations | Deny application access until authoritative entity/assignment relationships and capability decisions exist |
| anon, other buckets/paths, nonactive membership | Deny |

This intentionally does not allow admins to browse all personal avatars by default. Future sensitive-document read/write must be explicit per capability and entity relationship; being a member, teacher or parent alone is insufficient. Service-role clients bypass RLS and must not serve ordinary user uploads/reads. A tightly scoped maintenance credential can handle verified orphan/retention jobs outside RLS, in a separate operator process with strict bucket/path allowlists.

PostgreSQL policies can combine permissively: adding a narrower policy alongside 002 does not remove its broad grant. Implementation must inventory every existing storage.objects policy, remove/replace all applicable broad policies transactionally, preserve unrelated known policies, and verify no unknown policy reopens access. Verify bucket public=false and configure MIME/size limits through supported Storage interfaces. Do not directly modify Storage metadata to simulate object upload/deletion.

Signed access: authenticate and authorize afresh, resolve an authorized metadata ID server-side, then issue a short-lived URL (proposed 60 seconds) or authenticated download. Never accept an arbitrary caller path for privileged signing. Do not persist/log signed URLs or put them into exports. A signed URL is a bearer capability that can remain usable until expiry after membership revocation; use a checking download endpoint if immediate revocation is required. Private files must not use getPublicUrl. Avatar initial limits: 2 MB, JPEG/PNG/WebP, detected content with image decode/re-encode before acceptance; SVG/HTML disallowed. Application validation and bucket limits both required.

## File metadata and lifecycle

Future generic metadata design, not a table created in this change: file ID, school ID, subject relation, category, bucket/key, version, creator from auth context, server timestamps, detected MIME, byte size, SHA256, state, retention_until, legal_hold, supersedes/reference. Unique bucket+key, immutable school/creator, tenant FK relationships once business entities exist. Client cannot change verified MIME/hash, actor, lifecycle state or attach a foreign file. Global profiles.avatar_path must not become authority for tenant-specific avatars; resolve through authorized metadata and current tenant instead.

1. Upload: authorize actor and quota, reserve pending version, upload to exact reserved key without upsert, verify bytes/type/hash, then atomically mark available and attach reference in PostgreSQL. Pending versions cannot be downloaded. Until this flow exists, keep upload disabled.
2. Replace: upload/verify a new version first; atomically switch metadata reference and mark old version superseded. Keep old binary until retention permits deletion. Failed replacement preserves old reference.
3. Archive: update metadata state/access and retention; do not move keys or turn buckets public. Archive is distinct from backup.
4. Delete: authorize actor, check references/hold/retention, record delete_pending. Use Storage API removal, then mark deleted. Retriable finalization handles already-missing objects. Never delete metadata first or cascade source deletion into uncontrolled binary deletion.
5. Orphans: inventory by manifest and metadata; pending older than a proposed 24-hour grace window becomes reviewable, not immediately deleted. Dry-run reports, check active uploads/references/backups/holds, quarantine eligibility, then explicit reviewed purge. Never run destructive mirror sync against production.
6. Retention: owner approves durations by category before accepting sensitive files. No fabricated legal duration. Keep deletion evidence without content; expired backups must age out independently and restore must reapply deletion records.

Storage API and PostgreSQL are not one distributed transaction. Pending/deleting states, idempotency keys, retry and reconciliation are required; do not claim rollback across both. File lifecycle audit is a future append-only event addition in 008+, with field/state identifiers only. 007 does not currently audit Storage operations.

## Google Drive integration

Intended owner: alwisginting@gmail.com, ordinary Google account. Use owner-consented OAuth authorization code flow, server-side token exchange/refresh, least-privilege drive.file scope and offline access. Scope covers app-created or explicitly authorized files, not arbitrary pre-existing Drive content. Let the app create its root folder after consent and store folder IDs; names are not authority. Existing folders require explicit selection/access rather than assuming a known name is authorized. This approach follows [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Use separate local/production OAuth clients with exact callbacks, one-time state bound to authenticated administrator session, validate issuer/audience/subject for owner identity if OpenID identity is used, and never rely only on a typed owner email. Restrict integration setup to an explicitly designated operator; school admin alone must not unlock a whole-project backup. Store client secret/refresh token only in protected server secret storage; encrypt any persisted integration token with a separate key. Never return tokens to browser, logs, Git or NEXT_PUBLIC variables. Refresh/revocation failures mark backup failed and require reconnect; never report success without uploaded verified artifacts. See [web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

An external OAuth app in Testing normally gets refresh tokens expiring in seven days for Drive scope. Production publishing is not a guarantee tokens never expire; handle revocation and account changes. Owner must review current consent/verification requirements before operational scheduling. See [OAuth token expiration](https://developers.google.com/identity/protocols/oauth2). Do not assume a Gmail account has Workspace domain-wide delegation or Shared Drives; user OAuth is the selected design.

```text
SIM KB DEVFANTA MELATI/
  Backups/
    Database/
    Storage/
  Exports/
    Data Siswa/
    Absensi/
    Keuangan/
    Raport/
  Documents/
```

These are conceptual folders only, not created. Backup artifacts are encrypted before Drive upload, root sharing restricted to owner/recovery custodian, no anyone-with-link. Add opaque tenant ID subfolders for tenant exports; whole-project database backups are operator-only because they contain multiple tenants and Auth data. Documents is an archive area, never an operational upload source. Exports categories reserve future names and do not implement business modules.

## Backup and restore strategy

A database backup does not contain Storage file bytes; Free plan operators should maintain off-site exports. See [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups). Do not call source Git a data backup.

Proposed first operating mode: manual, owner-run backup from a trusted workstation into encrypted storage outside the repository; optionally schedule later using an existing trusted machine. No Redis/worker/service is required. A sleeping/offline workstation misses schedules, so review run timestamps and failures. Do not run a full DB/binary backup inside a browser request or assume Vercel function duration/disk can support it. Nothing is scheduled here.

| Artifact | Contents and verification | Proposed cadence |
|---|---|---|
| PostgreSQL | Consistent logical dump, application data including audit_logs, schema/functions/triggers/policies/grants and reviewed roles; explicit recovery plan for Auth users/identities and provider-managed schemas. Validate tools' default exclusions; do not assume a public-only dump recovers accounts. Encrypted manifest includes schema/checkpoint, row counts and checksums. | Daily when operational; before approved migrations |
| Storage | Enumerated private bucket objects downloaded via Storage API/S3, original keys, sizes, SHA256 and bucket config; paginate inventories and verify completeness. Metadata alone is not a backup. | Initial full; subsequent immutable changed versions plus periodic full manifest |
| Generated exports | Tenant-scoped minimal CSV/PDF/etc plus creator, format/schema version, snapshot time and hash; prevent spreadsheet formula injection. Not a restorable database backup. | Explicit authorized request; no business export implemented yet |
| Config/source | Git checkpoint, redirect/SMTP/provider configuration checklist without secrets; credentials recovered separately from protected store | On approved change |

Use a reviewed quiet-write window for paired DB+Storage backup until immutable versioning permits a documented consistency watermark. A database snapshot and file copy at different times can mismatch. If any referenced binary is missing or hash differs, mark backup incomplete. Upload encrypted artifact + manifest, verify remote size/hash or download/decrypt/hash roundtrip; only then record success. Never log contents or secrets.

Proposed objectives, not guarantees: RPO 24 hours; RTO one working day, both validated by a drill. Initial capacity-dependent retention proposal: seven daily sets and four weekly sets, with incremental binary copies to avoid full duplication. Keep a separate offline encrypted copy and offline recovery key; Drive alone is not a disaster strategy. Owner must approve retention against actual capacity and data requirements; no automatic deletion/purge configured.

Restore drill, at least quarterly and after schema changes: choose complete encrypted set, verify/decrypt on isolated environment, restore schema/data/roles with a reviewed Supabase-compatible procedure, preserve historical audit actor/time and avoid trigger replay, restore binaries via supported Storage API, verify hashes/references and re-enable/check grants/RLS/triggers. Prevent outgoing real email and revoke/isolate sessions. Test two-tenant access and application smoke, record actual recovery times. Migration 007 guards mean naive replay of INSERTs is not an adequate audit restore procedure. No SQL or restore is executed by this document.

## Cost envelope and release gates

Target Rp0/month is conditional on eligibility and quotas, not a security guarantee. As checked 2026-09-24, Supabase Free lists 500 MB DB, 1 GB files and 5 GB egress (plus 5 GB cached egress), without automatic backups/PITR; projects may pause after inactivity. See [current pricing](https://supabase.com/pricing). Downloading a 1 GB full Storage backup daily would consume roughly 30 GB/month before normal traffic; use verified changed-object copies, budget headroom and monitor usage. Do not omit required backups to hide quota pressure.

Drive consumes the owner's available account capacity shared with other Google products; check remaining quota before each run. Vercel Hobby limits usage to personal non-commercial projects; confirm this school's use is eligible rather than promising a free commercial deployment. See [Hobby terms](https://vercel.com/docs/plans/hobby). If quotas or eligibility cannot support secure operation, reduce accepted workload or revisit hosting/budget with the owner before accepting more data.

Before implementation: inventory buckets/objects and all policies; approve access/retention and live-file transition; prepare 008+ without editing applied migrations. Before enablement: run ordinary-user tests for five roles/two tenants, owner/nonowner, suspended/pending, malformed paths, bucket swaps, move/copy/upsert, signed access, revocation, file limits, orphan retry and direct REST bypass. Include positive controls so empty fixtures cannot masquerade as isolation. Review any preexisting signed URLs and legacy object names before tightening access. Never rewrite production keys silently.

Storage technical references: [access control](https://supabase.com/docs/guides/storage/security/access-control), [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Storage schema](https://supabase.com/docs/guides/storage/schema/design). This design is a proposal derived from those interfaces and the repository's current policy model; it is not tested live SQL.

Google authentication is a separate foundation feature: see [AUTH-FOUNDATION.md](AUTH-FOUNDATION.md). Basic login does not request Drive/offline scopes or retain Google API tokens; this backup design does not share its consent or credentials.
