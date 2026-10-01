# F6 — Import, Export, and Print Foundation

F6 is reusable platform infrastructure only. It creates no business module, database record, route, navigation entry, schema, migration, or mutation endpoint. It does not alter auth, authorization, capabilities, tenant rules, RLS, or Storage. Future callers must supply already-authorized rows and explicit columns.

## Architecture

`src/lib/tabular-engine.ts` separates the interchange concerns:

1. `TabularColumn`/`TabularSchema` define stable keys, labels, import/export headers, required fields, examples, parsers, normalizers, validators, serializers, and optional row validation.
2. `validateImportFile` checks the `.csv` extension, a small allowed MIME-hint list, and file size. Filename/MIME are hints only; bytes are strictly UTF-8 decoded and parsed content is validated.
3. `parseCsv` handles UTF-8 text, optional BOM, comma-delimited RFC-style quoted values, escaped quotes, embedded line breaks, CRLF/LF, empty and trailing cells, and deterministic physical starting line numbers.
4. `validateHeaders` normalizes header matching with Unicode NFKC, trim, whitespace collapse, and case-insensitive comparison. Duplicate/empty/missing-required headers fail. Unknown columns default to reject; a schema may explicitly choose ignore. Ambiguous headers never map silently.
5. `previewCsv` parses, normalizes, and validates rows without mutation. Each result keeps the source row number, valid/invalid/skipped state, normalized valid values, field errors, and row errors. Callback exceptions become safe generic errors.
6. `exportCsv` serializes caller-provided rows using caller-provided columns in stable order. Unsupported object values require a column serializer or fail.
7. `createCsvTemplate` derives deterministic headers/example cells from the same schema.
8. `csvAdapter` is the supported format adapter. `xlsxAdapter` is deliberately `null`; the adapter boundary leaves a future library integration point.

## CSV-only and resource limits

No suitable XLSX library is a direct dependency. F6 adds no packages and does not hand-code ZIP/XML. XLSX import/export is deferred and the file picker advertises CSV only.

Default configurable limits are:

- File: 2 MiB
- Data rows: 5,000 (header excluded)
- Columns: 100
- Cell: 8,000 JavaScript characters
- Preview UI: first 100 rows

These are conservative application defaults, not service-wide capacity guarantees. Parsing is bounded but buffers the selected file in memory; large-file streaming is out of scope. A future module can pass lower/higher reviewed limits, but parser limits must remain finite positive safe integers.

## Two-phase import and authorization

**Phase 1: parse → normalize → validate → preview.** `CsvImportPreviewPanel` only reads a local file and renders a preview. It has no Server Action, database client, confirmation-to-mutation callback, or hidden submit path. Errors and exception details are not echoed.

**Phase 2: explicit confirmed mutation belongs to a future business module.** That module must perform a fresh authenticated user check, capability and active-membership check, derive the active tenant server-side, revalidate every normalized row, enforce database constraints, and mutate through an authorized server path. A preview object is data, never authorization or proof that state is still current.

CSV values such as `school_id`, `tenant_id`, `organization_id`, `role`, `membership_status`, `is_admin`, `user_id`, or `owner_id` are ordinary untrusted file input. They must never select tenant scope or grant privilege. F6 does not provide a generic arbitrary-table import API.

## Export and spreadsheet safety

Export callers supply bounded, already-authorized rows and an explicit allowlisted column list. F6 does not query a database or expose a generic export endpoint. Future callers should fetch bounded/paginated data server-side and enforce current tenant/capability/RLS before passing any export representation to a client.

CSV uses CRLF records, stable headers/order, RFC-style quote escaping, Unicode text, and empty cells for null/undefined. A UTF-8 BOM is optional and off by default. Values starting with optional whitespace/control characters then `=`, `+`, `-`, or `@` are prefixed with an apostrophe unless they are finite numeric values declared as a number column and accepted by F5's exact numeric parser. This is a mitigation for common spreadsheet formula injection behavior, not a promise of identical interpretation by every spreadsheet application. Do not strip arbitrary legitimate characters or treat the output as trusted HTML.

`safeFilename` replaces path separators, control characters, unsupported filename punctuation, and traversal-like edge dots; it bounds the stem and emits only `.csv`. Filenames remain presentation metadata, never storage paths.

## Print foundation

`PrintablePage`, `PrintOnly`, `NoPrint`, and client-only `PrintButton` provide a small composition boundary. `PrintButton` calls `window.print()` only in a client component. CSS `@media print` hides dashboard chrome, native controls and explicit no-print content; it shows print-only content, adds browser page margins, removes dashboard padding/background, repeats table headers, and changes the F4 contained scroller to visible overflow for printing. Wide tables may still paginate or scale according to the browser/printer; no pixel-perfect PDF or PDF-generation dependency is included. Browser **Print → Save as PDF** is the supported initial PDF-ready path.

Print markup must only render data already authorized for the current request and tenant. There is no public print route or security bypass.

## Accessibility and responsive behavior

The preview uses a labeled file input and descriptive limits, polite status updates, alert feedback, a result summary, and F4's captioned, keyboard-focusable, horizontally contained data table. Long filenames/errors wrap. Summary tiles and actions wrap at narrow widths. Print controls are semantically buttons. These primitives do not claim full WCAG conformance.

Automated coverage validates markup/CSS contracts and parser behavior. It does not simulate an authenticated or hydrated browser session, real device viewport rendering, a real spreadsheet application, or a physical printer.
