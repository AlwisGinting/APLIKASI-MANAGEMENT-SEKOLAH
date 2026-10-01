"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { DataTable, type DataColumn } from "@/components/data/data-table";
import {
  createCsvTemplate,
  createImportPreview,
  decodeCsvBytes,
  formatHeaderIssues,
  formatFileIssue,
  safeFilename,
  validateImportFile,
  type DownloadMetadata,
  type ImportPreview,
  type TabularColumn,
  type TabularLimits,
  type TabularSchema,
} from "@/lib/tabular-engine";

const PREVIEW_ROW_LIMIT = 100;
const EMPTY_QUERY = { page: 1, pageSize: 25, q: "", sort: "rowNumber", direction: "asc" as const, filters: {} };

type State =
  | { status: "idle" }
  | { status: "reading"; filename: string }
  | { status: "error"; filename: string; message: string }
  | { status: "preview"; filename: string; size: number; preview: ImportPreview };

type DisplayRow = ImportPreview["rows"][number];
function displayValue(value: unknown, column: TabularColumn): string {
  if (value === null || value === undefined || value === "") return "—";
  try {
    if (column.serialize) return column.serialize(value);
    if (["string", "number", "boolean", "bigint"].includes(typeof value)) return String(value);
  } catch { return "Nilai tidak dapat ditampilkan"; }
  return "Nilai tidak dapat ditampilkan";
}
function errorText(row: DisplayRow, columns: readonly TabularColumn[]): string {
  const labels = new Map(columns.map(column => [column.key, column.label]));
  const fields = Object.entries(row.fieldErrors).flatMap(([key, messages]) => (messages ?? []).map(message => `${labels.get(key) ?? "Isian"}: ${message}`));
  return [...fields, ...row.rowErrors].join(" ") || (row.status === "skipped" ? "Baris kosong dilewati." : "");
}
function previewColumns(schema: TabularSchema): DataColumn<DisplayRow>[] {
  return [
    { id: "rowNumber", header: "Baris", cell: row => row.rowNumber },
    { id: "status", header: "Status", cell: row => row.status === "valid" ? "Valid" : row.status === "invalid" ? "Perlu diperbaiki" : "Dilewati" },
    ...schema.columns.map(column => ({ id: column.key, header: column.label, cell: (row: DisplayRow) => displayValue(row.values?.[column.key], column) })),
    { id: "errors", header: "Validasi", cell: row => errorText(row, schema.columns) || "—" },
  ];
}

export function CsvImportPreviewPanel({ schema, limits, id }: { schema: TabularSchema; limits?: Partial<TabularLimits>; id?: string }) {
  const inputId = useId();
  const panelId = id ?? inputId;
  const input = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [state, setState] = useState<State>({ status: "idle" });
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    const currentRequest = ++requestId.current;
    if (!file) { setState({ status: "idle" }); return; }
    const accepted = validateImportFile(file, limits);
    if (accepted) { setState({ status: "error", filename: file.name, message: formatFileIssue(accepted) }); return; }
    setState({ status: "reading", filename: file.name });
    try {
      const parsed = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()), limits);
      if (currentRequest !== requestId.current) return;
      if (!parsed.ok) { setState({ status: "error", filename: file.name, message: formatFileIssue(parsed.issue) }); return; }
      const result = createImportPreview(parsed.document, schema);
      if (!result.ok) {
        const detail = result.issue.headerIssues ? formatHeaderIssues(result.issue.headerIssues).join(" ") : result.issue.message;
        setState({ status: "error", filename: file.name, message: detail });
        return;
      }
      setState({ status: "preview", filename: file.name, size: file.size, preview: result.preview });
    } catch {
      if (currentRequest === requestId.current) setState({ status: "error", filename: file.name, message: "File tidak dapat dibaca sebagai CSV UTF-8." });
    }
  }
  function clearFile() {
    requestId.current++;
    if (input.current) input.current.value = "";
    setState({ status: "idle" });
  }
  const result = state.status === "preview" ? state.preview : null;
  const rows = result?.rows.slice(0, PREVIEW_ROW_LIMIT) ?? [];
  return <section className="csv-import-panel" aria-labelledby={`${panelId}-title`}>
    <h2 id={`${panelId}-title`} className="text-lg font-semibold">Pratinjau impor CSV</h2>
    <p className="muted mt-2">Pratinjau hanya memeriksa file. Tidak ada data yang disimpan.</p>
    <div className="import-file-control mt-5">
      <Field id={`${panelId}-file`} label="Pilih file CSV" description="UTF-8; batas ukuran dan baris diterapkan sebelum pratinjau.">
        {fieldProps => <Input {...fieldProps} ref={input} type="file" name="csv_file" accept=".csv,text/csv,application/csv,application/vnd.ms-excel" onChange={selectFile} />}
      </Field>
      {state.status !== "idle" && <Button type="button" variant="outline" onClick={clearFile}>Bersihkan file</Button>}
    </div>
    {state.status === "reading" && <p role="status" aria-live="polite" className="muted">Membaca {state.filename}…</p>}
    {state.status === "error" && <Alert tone="destructive" title="File belum dapat dipratinjau"><span className="import-file-name">{state.filename}</span><p>{state.message}</p></Alert>}
    {result && state.status === "preview" && <>
      <p role="status" aria-live="polite" className="import-file-name">{state.filename} · {state.size} byte</p>
      <dl className="import-summary" aria-label="Ringkasan pratinjau">
        <div><dt>Total baris</dt><dd>{result.totalRows}</dd></div><div><dt>Valid</dt><dd>{result.validRows}</dd></div><div><dt>Tidak valid</dt><dd>{result.invalidRows}</dd></div><div><dt>Dilewati</dt><dd>{result.skippedRows}</dd></div>
      </dl>
      {result.invalidRows > 0 && <Alert tone="warning" title="Periksa baris yang tidak valid">Baris tidak valid tidak dapat digunakan sebelum diperbaiki.</Alert>}
      <DataTable caption="Pratinjau baris CSV" rows={rows} columns={previewColumns(schema)} rowKey={row => String(row.rowNumber)} query={EMPTY_QUERY} />
      {result.rows.length > PREVIEW_ROW_LIMIT && <p className="muted" role="status">Menampilkan {PREVIEW_ROW_LIMIT} dari {result.rows.length} baris pratinjau.</p>}
    </>}
  </section>;
}

export function CsvTemplateButton({ columns, filename, includeExampleRow = false }: { columns: readonly TabularColumn[]; filename: string; includeExampleRow?: boolean }) {
  return <Button type="button" variant="outline" onClick={() => {
    const content = createCsvTemplate(columns, { includeExampleRow });
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFilename(filename);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }}>Unduh template CSV</Button>;
}

export function CsvDownloadButton({ download, label = "Unduh CSV" }: { download: DownloadMetadata; label?: string }) {
  return <Button type="button" onClick={() => {
    const url = URL.createObjectURL(new Blob([download.content], { type: download.contentType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFilename(download.filename);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }}>{label}</Button>;
}
