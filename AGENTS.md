<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository security rules

- Migrations `001` through `007` are applied and immutable. Any schema change requires a reviewed migration `008+`; never run production SQL or seed data during ordinary development.
- Authentication is not authorization. Tenant access requires current active membership, role/capability checks, and database RLS. Never trust email, OAuth metadata, browser state, query parameters, or user metadata for privilege.
- Keep `SUPABASE_SECRET_KEY` server-only and never commit secrets or real environment values.
- Do not add a web shell, arbitrary command endpoint, `child_process`, `exec`, or `spawn` path. Development happens in VS Code and the integrated terminal.
- Validate with `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and `git diff --check` when Node is available. Prefer focused checks after each edit.
- Commit, push, deploy, provider configuration, migration execution, and production credential changes require explicit owner approval.
