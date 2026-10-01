# F4 data experience foundation

The F3 checkpoint is `be2f34bd59beb1ea9dc51ca3b1079ea52d177978`.
Existing F2 Button/Input/Select/Label, Badge, Skeleton, EmptyState and ErrorState
are reused. Existing lists are domain-specific cards/forms; F4 does not migrate
those pages or add a demo route. F3 Page/PageHeader and shell remain unchanged.

## Server integration contract

Await the Next.js page's `searchParams` promise, then call `serverQuery` with a
developer-owned QueryConfig, a literal public-sort-key to database-field map,
and a unique tie-break field. The result contains normalized state, offset,
bounded limit and deterministic order. It does not execute queries.

```ts
type ExampleRow = { id: string; name: string };
const config = {
  sorts: ["name"], defaultSort: "name", filters: [],
} satisfies QueryConfig;
const request = serverQuery(await searchParams, config, { name: "display_name" }, "id");
// Authorized, tenant-scoped adapter returns DataPage<ExampleRow>:
// { rows: current page only, total: count for the SAME authorized filters }.
// Render DataToolbar, DataTable and DataPagination with request.state.
```

The future adapter must enforce the current authenticated membership,
capabilities and tenant scope before both row and count queries, with RLS still
authoritative. Never spread raw URL parameters into a query builder or SQL.
Map each filter key to a literal field/operator. Search text remains untrusted:
use supported bound query values, and escape LIKE wildcards when literal search
is intended. Never concatenate it into SQL or a PostgREST expression.
No adapter or database call is implemented in F4.

Page results must contain at most `limit` rows. A unique immutable secondary
order prevents ties, but offset pagination is not a snapshot across concurrent
writes. Cursor pagination can be introduced for a concrete module later.

## URL and interaction

- `page`: positive integer, maximum 100000; invalid/ambiguous input becomes 1.
- `pageSize`: 10, 25 or 50; default 25.
- `q`: trimmed, whitespace/control-normalized, at most 200 characters.
- `sort`: public key from the configuration; default is required in that list.
- `direction`: `asc` or `desc`; invalid input becomes `asc`.
- `filter.<key>`: explicit configured single-value allowlist. Repeated input is
  rejected rather than guessing. Unknown parameters are intentionally dropped.

QueryConfig keys, labels, column sortKey and field mappings are trusted source
configuration, never request-derived. Use unique filter keys and toolbar IDs.
`queryHref` accepts already normalized state, not raw URL input.
Native GET forms and ordinary same-path links require no client JS. Refresh and
browser history retain the URL. Search/filter/page-size submission resets page;
sort resets page and preserves search/filters; pagination preserves all state.
Reset clears search/filters while retaining sort and page size. No debounce or
request per keystroke. This foundation owns the page query string; unrelated
module query keys require an explicitly reviewed extension.

## Presentation and feedback

DataColumn defines a stable id, human header, cell renderer, optional alignment
and optional sortKey. DataTable uses caller-provided stable unique row keys,
caption, scoped headers and aria-sort. Null/undefined/empty-string cells show
"Belum diisi"; numeric zero is preserved. Text wraps without hiding its full
value. Render existing Badge with domain-owned labels/tones for statuses.
Optional action renderers may supply labelled links/buttons after caller
capability checks; these are presentation only, never an authorization boundary.
There are no default destructive actions.

Loading uses F2 skeletons and a status announcement. Errors use the generic F2
ErrorState and accept no raw exception. Empty and filtered no-results are
distinct. A stale out-of-range page offers page-one recovery instead of claiming
the whole dataset is empty. Pagination requires a nonnegative integer total
for the current filters; disabled boundaries are native buttons. Very deep
pagination prompts narrower filtering rather than generating invalid URLs.

Calendar dates are strict YYYY-MM-DD and formatted without timezone shifting.
Instants require an explicit offset and reuse the existing Indonesian/WIB
formatter. No stored date values are modified.

Tables keep readable sizing inside a labelled, focusable horizontal scroll
region. Search/filter and pagination controls wrap. No viewport-wide overflow
is intended. Selection/bulk actions, export, editing, virtualization and actual
business modules are deliberately deferred.

## Validation and offline reference

`npm.cmd test` includes F4 tests in the existing design-system suite; package
scripts/dependencies are unchanged. Run lint, typecheck and build normally.
After build, set `F2_PREVIEW=1` only for `node --test tests/design-system.test.mjs`,
then unset it. This writes synthetic F4 table/state fixtures alongside existing
F2/F3 fixtures in the OS TEMP `f2-ui-preview` folder, never the repository.
`node tests/shell-browser.mjs` generates the offline runner there. Open
`f3-runner.html` in the existing Edge headless browser with file access enabled.
The runner checks 320/360/390/768/1280 widths, body overflow, contained scrolling,
row-action reachability, control sizes, focus and F3 shell bounds.

This proves static fixture layout and native DOM behavior, not authenticated
navigation, actual server queries, full keyboard/screen-reader behavior, browser
back/forward end-to-end or full WCAG compliance. Runtime database/RLS proof is
deferred. No production data, migrations, credentials or business records are
needed for these fixtures.
