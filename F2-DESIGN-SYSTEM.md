# F2 design system report

## Audit

The restored branch matched `f67fc438056597fb749fc6648f344b73f709cc2d` exactly and began clean. The existing UI already had server-side capability checks, capability-filtered navigation, a native mobile dialog, a skip link, and server-rendered light/dark/system preferences. These patterns were retained.

Duplicated patterns included form controls, button styles, alerts, auth cards, page headings, and empty/error states. Users had a separate page composition and small action text. Auth-state pages repeated the login frame. Auth and dashboard colors were separately hard-coded. Disabled controls incorrectly used a waiting cursor. The login fallback had the same visual emphasis as Google. Password reveal buttons and user actions needed larger targets. The users grid switched to columns before the sidebar layout left adequate space.

## Implemented

- Semantic surface, text, muted, border, control border, primary, secondary, success, warning, destructive, info and focus tokens; typography, section spacing, control/card radii, shadows and page width. Existing theme preferences remain supported.
- Shared Button (five variants, pending, disabled, children/icons), Input, Textarea, Select, Checkbox, Label, Field, FieldError, FieldDescription, Card, Badge, Alert, Separator, Skeleton, Spinner, EmptyState, ErrorState and PageHeader. Existing Avatar now uses semantic styling.
- Page composition supports a title, description, optional breadcrumb and action. Existing settings, security, help and System Center inherit shared Page/Card updates.
- Existing shell retained, with normalized active navigation, stronger focus treatment, wrapping brand and compact account identity. Native mobile dialog behavior and capability filtering remain in place.
- Google remains primary; email/password uses secondary styling. Existing forgot-password paths, duplicate-submit protection and optional password settings remain intact.
- Pending/rejected/suspended/no-membership pages reuse AuthCard and explicit status badges. Error and loading boundaries share safe feedback primitives.
- Akses Dasar explicitly describes an active account awaiting an operational role, with no permission changes.
- Form error associations retained; reusable Field supplies label/error/description IDs. Larger touch targets, stronger control borders, reduced-motion spinner support, semantic status messages and disabled cursors.
- Users reuse Page, Alert, EmptyState, Select, Button and Badge. Responsive records remain stacked below 1280px, with long identity wrapping and visible action text. No DataTable engine or business module was added.

## Files created

- `src/app/design-system.css`
- `src/components/ui/index.tsx`
- `tests/design-system.test.mjs`
- `tests/design-system-browser.mjs`
- `F2-DESIGN-SYSTEM.md`

## Files modified

- `package.json` (test command only)
- `src/app/globals.css`
- `src/app/dashboard/error.tsx`
- `src/app/dashboard/loading.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/users/page.tsx`
- `src/app/not-found.tsx`
- `src/app/pending-approval/page.tsx`
- `src/components/auth/auth-card.tsx`
- `src/components/auth/auth-form.tsx`
- `src/components/auth/google-login.tsx`
- `src/components/dashboard/navigation.tsx`
- `src/components/dashboard/settings-form.tsx`
- `src/components/dashboard/ui.tsx`
- `tests/foundation.test.mjs` (shared component test resolution)

## Validation

- Tests: 130 pass (123 existing plus seven design-system cases).
- Lint, typecheck, production build, diff-check: pass.
- Browser: 55 offline fixture/page-width combinations across 320, 360, 390, 768 and 1280px. Checks cover page overflow, visible button heights, and keyboard focus entry. Dashboard fixtures also check dark-mode overflow. Mobile and desktop screenshots were generated; representative login, dashboard, users and security screenshots were inspected.
- Fixtures render actual page/component source with synthetic identities and mocked server dependencies. They do not prove authenticated end-to-end flows, hydrated dialog interactions, or runtime database/RLS behavior. Those were not exercised.
- Initial sandboxed build could not download existing Google Fonts; the network-enabled build passed without changing the font setup.

Node v24.19.0 / npm 11.17.0. Installed from the existing lockfile using `npm.cmd ci --no-audit --no-fund`. No application dependency added, no upgrade, no lockfile change. Playwright was installed only into a temporary external test directory, using the existing Edge browser.

The expected Supabase environment variables were missing. No credentials or environment files were created. Only `.env.example` is tracked; `supabase/.temp/` remains ignored.

## Security and Git

- Authorization semantics: unchanged; navigation remains UX only.
- Akses Dasar permissions: unchanged.
- Migrations 001–009: unchanged against checkpoint.
- Database changes: none. SQL, migrations, runtime DB/RLS proof and production preflight remain deferred.
- Secrets: no values requested, created or printed.
- Branch: `checkpoint/google-first-basic-access`.
- HEAD before and after F2: `f67fc438056597fb749fc6648f344b73f709cc2d`.
- Working tree: intentional uncommitted F2 changes. No commit, push, merge or deployment.

F2 SOURCE IMPLEMENTATION: PASSED

READY FOR REVIEW: YES

F3 was not started.

## Component usage and responsive conventions

Import primitives from `@/components/ui`; dashboard pages use `Page` from `@/components/dashboard/ui`. Keep server-side capability checks in pages/actions. Use semantic variants instead of route-specific colors. Buttons default to `type="button"`; specify `type="submit"` for forms. Loading buttons must retain an understandable pending label. Use links for navigation.

Field accepts an explicit stable ID and passes `id`, `aria-invalid`, and `aria-describedby` to its control render function. Do not put credentials into component state or test artifacts. PageHeader accepts breadcrumb content and an optional action; actions wrap on narrow screens.

Future dense records should stack below their usable column width, allow identity text to wrap, and keep controls at least 44px high. Prefer local horizontal scrolling with an accessible label only for genuinely tabular content; avoid page-level overflow. Existing Tailwind breakpoints remain unchanged (640px small layout, 1024px desktop shell, 1280px wide record layout).

To reproduce offline browser fixtures in PowerShell after building:

```powershell
$env:F2_PREVIEW = '1'
node --test tests/design-system.test.mjs
node tests/design-system-browser.mjs "$env:TEMP\f2-browser-tools\node_modules\playwright"
Remove-Item Env:F2_PREVIEW
```

The optional browser command requires a separately installed Playwright module and Edge. Fixtures/screenshots are written under the OS temporary `f2-ui-preview` directory, not into application routes.
