# F5 — Form & Data Integrity Engine

F5 provides reusable building blocks for future record forms. It does not add or change business modules, database schema, migrations, auth, capabilities, or RLS. Existing auth forms keep their dedicated actions and validation flows.

## Building blocks

- `Field` from `@/components/ui` associates its label, required marker, description, invalid state, and field error. Its child render function must pass the supplied props to the actual control.
- `readSingleText`, `normalText`, `optionalText`, `normalizeEmail`, `parseNumber`, `parseCheckbox`, and `parseCalendarDate` are server-safe helpers in `@/lib/form-engine`.
- `ValidationResult<Field>` and `MutationResult<Field>` are discriminated contracts. Validation feedback contains developer-authored messages; mutation failures are generic and never contain raw backend errors, exception details, credentials, or submitted values.
- `FormFeedback` renders safe form-level feedback and an allowlisted, linked field-error summary.
- `RecordForm` is an opt-in client composer for non-sensitive create/edit records. The caller supplies its server action, field-ID/label map, the explicit `dirtyFields` allowlist, and controls as children. Use `key={recordId ?? "new"}` when switching records so trusted initial values establish a fresh form baseline.

## Server action pattern

Actions must repeat parsing, normalization, validation, authorization, and tenant scoping on the server. Client validation is useful feedback, never authority. Use the existing authenticated server client, derive tenant and actor from current server context, and retain RLS as the data boundary.

```ts
const rawName = readSingleText(formData, "name");
if (!rawName.ok) return mutationFailure();
const name = normalText(rawName.value ?? "");
const result = validated({ name }, name ? {} : { name: ["Nama wajib diisi."] });
if (!result.ok) return mutationInvalid(result);

// Require the current capability, scope the mutation to the current tenant,
// select only expected columns, and check both database error and affected row.
return mutationSuccess();
```

Do not return raw Supabase errors. Choose allowlisted messages by known error code; unexpected errors map to `mutationFailure()`. Redirecting flows remain separate; `RecordForm` requires a return-style action that resolves to `MutationResult`.

## Data integrity

- `readSingleText` rejects repeated values, `File` values, and other ambiguous input instead of silently picking one.
- Text helpers trim values; optional blank text becomes `null`. Email normalization lowercases only the domain, preserving local-part semantics for domain validation.
- Number parsing accepts finite decimal notation, treats blank optional values as `null`, rejects exponent/ambiguous syntax, unsafe magnitude, and decimal strings that would silently round during JavaScript number conversion. Add domain validation such as integer/min/max after parsing where needed; do not use binary floating point as a currency representation.
- Calendar dates remain `YYYY-MM-DD` date-only strings and are validated using the shared calendar-date validator. Do not convert date-only values through local timezone timestamps. Instants need a separate explicit-timezone contract.
- Checkbox parsing accepts the browser's single `on` value; absent means false. Do not interpret arbitrary truthy strings as permission or boolean authority.

## Interaction, privacy, accessibility

`RecordForm` captures `FormData` before disabling its fieldset, sets pending/busy state, and uses a synchronous submission gate so double submits cannot invoke the action twice in one mounted form. The fieldset is disabled during pending work. Exceptions become generic safe feedback.

Dirty tracking snapshots only caller-allowlisted uncontrolled, non-sensitive controls. Password, one-time-code, hidden, file, button, disabled, `data-sensitive`, and matching autocomplete controls are excluded. Snapshots remain in memory only; no localStorage, IndexedDB, network, or logging is used. Mark other sensitive controls with `data-sensitive` and never include their names in `dirtyFields`.

Successful results update the native default values and clear dirty state. Validation/error results preserve ordinary values for correction. Sensitive inputs are cleared after every submission result. Reset asks before discarding a dirty form; cancel uses the same confirmation. Dirty forms install a `beforeunload` warning and remove it once clean or unmounted. The warning is best-effort browser UX, not persistence or a guarantee against every navigation mechanism.

Field errors remain associated through `aria-describedby` and `aria-invalid`; the form summary links to the corresponding field. Alerts use urgent announcement for validation/errors and status announcement for success. CSS wraps actions and keeps controls within the viewport; verify at narrow widths and with long labels/error messages before consuming this foundation in a business form.

## Validation boundary and limitations

The shared foundation is not a domain schema, database constraint, authorization check, transaction, idempotency key, or autosave system. Future forms must add domain-specific constraints and tests. `RecordForm` is intentionally opt-in and currently supports uncontrolled native controls; controlled widgets need an explicit adapter and dirty-state integration. Auth/password workflows must continue using their dedicated components and actions, not `RecordForm`.
