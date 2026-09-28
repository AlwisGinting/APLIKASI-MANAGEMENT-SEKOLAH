# Disposable baseline 001-007 (Windows / Docker Desktop)

Test infrastructure only. Never run this against an existing database. Migration
008 remains a draft and is neither copied nor executed by this harness.

From the repository root, in a clean PowerShell terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/integration/disposable/bootstrap.ps1 -CheckOnly
powershell -NoProfile -ExecutionPolicy Bypass -File tests/integration/disposable/bootstrap.ps1 -Execute
```

`ExecutionPolicy Bypass` is scoped to this child process; it does not change the
machine policy. Prerequisites: Docker Desktop Linux engine, Node/npm/npx, internet
or cached Supabase CLI 2.118.0 and its images; TCP ports 56320-56322 and
56324-56326 must be available. The runner fails before startup when any are
occupied; it never stops an existing process or container. If a collision is
reported, identify and stop only the disposable stack that owns those ports,
then rerun.
No host psql installation is needed. No application `.env` file is loaded.

## Safety and provenance

- Verify the existing canonical-LF SHA256 manifest for exactly 001-007. Raw-byte
  hashes additionally protect file transfer and changes during execution.
- Require explicit `-Execute`. Reject inherited Supabase, PostgreSQL and Docker
  connection overrides without printing their values.
- Require the local Docker Desktop Linux named pipe. Remote Docker is rejected.
- Generate a new random project/workspace beneath the OS temporary directory.
  It contains a disposable ownership marker and an exact locally generated config.
  No migration directory, seed, `.env` or remote project link is permitted there.
- Start actual Supabase with migration replay and seeding disabled. CLI output is
  captured in memory because it can contain local keys; on failure, only filtered
  diagnostic lines are printed after key/token redaction. The isolated config uses
  the supported `[local_smtp]` section and explicitly assigns its web, SMTP, and
  POP3 ports.
- Prove the database container ID, creation time, running state, Supabase image,
  and project ownership label. Recheck ownership/config/endpoint before every SQL
  file. A database name alone is never sufficient evidence.
- `psql` uses `127.0.0.1` **inside that verified local container**, fixed postgres
  database/user, no application credentials, and `-X` to ignore psql startup files.
  SQL also checks the server address. Real Auth/Storage objects must exist, while
  public tables, enum, user data, buckets and migration ledger must be empty.
- Files transfer with `docker cp`, followed by a SHA256 check in the container.
  There is no SQL splitting, eval, configurable target URL or arbitrary SQL option.
- Stop on the first failure. Error output identifies the step and SQLSTATE without
  exposing raw CLI/SQL output. No automatic rewrite, skip, reset or repair.

## Transaction sequence and ledger

Each source file is executed whole and byte-for-byte. `psql --single-transaction`
commits 001, then the one compatibility statement below, then each of 002-006.
007 uses its own existing BEGIN/COMMIT without an additional wrapper.

```sql
ALTER TYPE public.membership_status ADD VALUE IF NOT EXISTS 'active';
```

This separate committed enum addition is **test-only compatibility infrastructure**,
not a source migration or a production schema fix. It resolves PostgreSQL's ban on
using a newly added enum value before its transaction commits. No other SQL repair
is permitted. Historical migration fingerprints are never regenerated.

The local migration ledger is intentionally **not populated**. CLI migrations are
disabled and no historical files are installed in the temporary project. The
external `baseline-ready.txt` receipt is written only after all validations pass;
it is not a production migration record. Do not use `migration up`, `db reset`,
`db push` or enable automatic migrations on this stack. Later 008 execution needs
separate authorization and a dedicated runner; this runner always stops at 007.

## What validation proves

`preflight.sql` verifies real Supabase Auth/Storage and a fresh database.
`validate.sql` checks enum order; eight foundation tables and RLS; policy and FK
counts; composite tenant FKs; Auth/audit relationships; function existence,
definer/invoker mode, search paths and effective EXECUTE privileges; 21 triggers;
four private buckets and four Storage policies; audit grants; default school;
and an empty migration ledger. It deliberately checks the **007 baseline**, including
existing broad helper permissions, rather than asserting that 008 is already present.

Catalog checks are not behavioral role/concurrency/RLS security tests, email
delivery tests, OAuth tests, or evidence of production parity beyond the immutable
application migrations. The fresh Auth/Storage services and schemas provide the
platform for those later tests. No auth users or role fixtures are seeded.

The unique stack and temporary workspace are retained for inspection and later
authorized tests, including on failure. There is no automatic cleanup/destruction
command. Re-running creates another fresh project; occupied ports cause startup
to fail rather than reusing an existing baseline.

## Repository hygiene

All generated workspace/config/cache/receipts live under OS TEMP, outside Git.
The pre-existing `supabase/.temp/cli-latest` is CLI cache, not bootstrap input.
Recommend adding `/supabase/.temp/` to `.gitignore` in a separate hygiene change;
this task does not remove or change that existing cache or ignore configuration.
`supabase/migrations/seed.sql` is not a timestamped migration and is never copied
or executed. Seeding is explicitly disabled, independently of its filename.

References: [Supabase local workflow](https://supabase.com/docs/guides/local-development/cli-workflows),
[PostgreSQL ALTER TYPE](https://www.postgresql.org/docs/current/sql-altertype.html).
