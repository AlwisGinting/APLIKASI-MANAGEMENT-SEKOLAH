import { parseCalendarDate as parseFormCalendarDate, parseNumber } from "@/lib/form-engine";

export const DEFAULT_TABULAR_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 100,
  maxCellCharacters: 8000,
} as const;
export type TabularLimits = { maxFileBytes: number; maxRows: number; maxColumns: number; maxCellCharacters: number };
export type FileDescriptor = { name: string; type: string; size: number };
export type ImportIssueCode = "unsupported-file" | "file-too-large" | "invalid-csv" | "row-limit" | "column-limit" | "cell-limit" | "invalid-headers";
export type ImportIssue = { code: ImportIssueCode; message: string; headerIssues?: readonly HeaderIssue[] };
export type ParseCellResult = { ok: true; value: unknown } | { ok: false; message: string };
export type TabularColumn = {
  key: string;
  label: string;
  importHeader?: string;
  exportHeader?: string;
  required?: boolean;
  kind?: "text" | "number" | "boolean" | "date";
  example?: string;
  parse?: (raw: string | null) => ParseCellResult;
  normalize?: (value: unknown) => unknown;
  validate?: (value: unknown, rowNumber: number) => string | null;
  serialize?: (value: unknown) => string;
};
export type TabularSchema = {
  columns: readonly TabularColumn[];
  unknownHeaders?: "reject" | "ignore";
  validateRow?: (values: Readonly<Record<string, unknown>>, rowNumber: number) => readonly string[];
};
export type HeaderIssue = { code: "empty" | "duplicate" | "missing-required" | "unknown" | "invalid-schema"; index?: number; columnKey?: string };
export type CsvRecord = { rowNumber: number; cells: readonly string[] };
export type CsvDocument = { headers: readonly string[]; records: readonly CsvRecord[] };
export type CsvParseResult = { ok: true; document: CsvDocument } | { ok: false; issue: ImportIssue };
export type HeaderCheckResult = { ok: true; mapping: ReadonlyMap<string, number> } | { ok: false; issues: readonly HeaderIssue[] };
export type PreviewRow = { rowNumber: number; status: "valid" | "invalid" | "skipped"; values?: Readonly<Record<string, unknown>>; fieldErrors: Readonly<Record<string, readonly string[]>>; rowErrors: readonly string[] };
export type ImportPreview = {
  status: "preview";
  headers: readonly string[];
  rows: readonly PreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  skippedRows: number;
};
export type ImportPreviewResult = { ok: true; preview: ImportPreview } | { ok: false; issue: ImportIssue };
export type TabularFormatAdapter<Source, Parsed> = {
  format: string;
  extension: string;
  mimeTypes: readonly string[];
  parse: (source: Source, limits?: Partial<TabularLimits>) => Parsed;
};
export type DownloadMetadata = { filename: string; contentType: "text/csv;charset=utf-8"; content: string; rowCount: number };

export function parseCalendarDateCell(value: string | null): ParseCellResult {
  const parsed = parseFormCalendarDate(value);
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, message: parsed.message };
}

const safeMessages: Record<ImportIssueCode, string> = {
  "unsupported-file": "Format file belum didukung. Gunakan file CSV UTF-8.",
  "file-too-large": "Ukuran file melewati batas yang diizinkan.",
  "invalid-csv": "Struktur CSV tidak valid. Periksa tanda kutip dan pemisah kolom.",
  "row-limit": "Jumlah baris file melewati batas yang diizinkan.",
  "column-limit": "Jumlah kolom file melewati batas yang diizinkan.",
  "cell-limit": "Ada sel yang melewati batas panjang yang diizinkan.",
  "invalid-headers": "Header file tidak cocok dengan format yang diperlukan.",
};
const issue = (code: ImportIssueCode, headerIssues?: readonly HeaderIssue[]): ImportIssue => ({ code, message: safeMessages[code], ...(headerIssues ? { headerIssues } : {}) });

function resolveLimits(limits: Partial<TabularLimits> = {}): TabularLimits {
  const resolved = { ...DEFAULT_TABULAR_LIMITS, ...limits };
  if (Object.values(resolved).some(value => !Number.isSafeInteger(value) || value <= 0)) throw new Error("Invalid tabular limits");
  return resolved;
}

export function validateImportFile(file: FileDescriptor, limits: Partial<TabularLimits> = {}): ImportIssue | null {
  const maximum = resolveLimits(limits).maxFileBytes;
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase().split(";", 1)[0].trim();
  const supportedMime = ["", "text/csv", "application/csv", "application/vnd.ms-excel"].includes(mime);
  if (!name.endsWith(".csv") || !supportedMime || !Number.isSafeInteger(file.size) || file.size < 0) return issue("unsupported-file");
  if (file.size > maximum) return issue("file-too-large");
  return null;
}

function isNewline(value: string) { return value === "\n" || value === "\r"; }
function consumeNewline(text: string, index: number) { return text[index] === "\r" && text[index + 1] === "\n" ? index + 2 : index + 1; }
function exceedsUtf8Limit(text: string, maximum: number): boolean {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes++;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; index++; }
      else bytes += 3;
    } else bytes += 3;
    if (bytes > maximum) return true;
  }
  return false;
}

export function parseCsv(text: string, limits: Partial<TabularLimits> = {}): CsvParseResult {
  const { maxFileBytes: maxBytes, maxRows, maxColumns, maxCellCharacters: maxCell } = resolveLimits(limits);
  if (exceedsUtf8Limit(text, maxBytes)) return { ok: false, issue: issue("file-too-large") };
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (!source.length) return { ok: true, document: { headers: [], records: [] } };
  const rows: CsvRecord[] = [];
  let fields: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  let fieldStart = true;
  let line = 1;
  let rowStartLine = 1;
  let touched = false;
  let columnIssue = false;
  let cellIssue = false;
  const append = (value: string) => {
    cell += value;
    if (cell.length > maxCell) cellIssue = true;
  };
  const finishField = () => {
    fields.push(cell);
    cell = "";
    fieldStart = true;
    closedQuote = false;
    if (fields.length > maxColumns) columnIssue = true;
  };
  const finishRow = () => {
    finishField();
    rows.push({ rowNumber: rowStartLine, cells: fields });
    fields = [];
    touched = false;
  };
  let index = 0;
  while (index < source.length) {
    if (cellIssue) return { ok: false, issue: issue("cell-limit") };
    if (columnIssue) return { ok: false, issue: issue("column-limit") };
    if (rows.length > maxRows + 1) return { ok: false, issue: issue("row-limit") };
    const current = source[index];
    touched = true;
    if (quoted) {
      if (current === '"') {
        if (source[index + 1] === '"') { append('"'); index += 2; continue; }
        quoted = false;
        closedQuote = true;
        index++;
        continue;
      }
      if (isNewline(current)) {
        const next = consumeNewline(source, index);
        append(source.slice(index, next));
        line++;
        index = next;
        continue;
      }
      append(current);
      index++;
      continue;
    }
    if (closedQuote) {
      if (current === ",") { finishField(); index++; continue; }
      if (isNewline(current)) {
        const next = consumeNewline(source, index);
        finishRow();
        line++;
        rowStartLine = line;
        index = next;
        continue;
      }
      return { ok: false, issue: issue("invalid-csv") };
    }
    if (fieldStart && current === '"') { quoted = true; fieldStart = false; index++; continue; }
    if (current === '"') return { ok: false, issue: issue("invalid-csv") };
    if (current === ",") { finishField(); index++; continue; }
    if (isNewline(current)) {
      const next = consumeNewline(source, index);
      finishRow();
      line++;
      rowStartLine = line;
      index = next;
      continue;
    }
    fieldStart = false;
    append(current);
    index++;
  }
  if (quoted) return { ok: false, issue: issue("invalid-csv") };
  if (touched || fields.length || cell.length || closedQuote) finishRow();
  if (rows.length > maxRows + 1) return { ok: false, issue: issue("row-limit") };
  if (columnIssue) return { ok: false, issue: issue("column-limit") };
  const headers = rows[0]?.cells ?? [];
  const records = rows.slice(1);
  return { ok: true, document: { headers, records } };
}

export function decodeCsvBytes(bytes: Uint8Array, limits: Partial<TabularLimits> = {}): CsvParseResult {
  const maximum = resolveLimits(limits).maxFileBytes;
  if (bytes.byteLength > maximum) return { ok: false, issue: issue("file-too-large") };
  try { return parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes), limits); }
  catch { return { ok: false, issue: issue("invalid-csv") }; }
}

export function normalizeHeader(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function validateHeaders(headers: readonly string[], schema: TabularSchema): HeaderCheckResult {
  const issues: HeaderIssue[] = [];
  if (!schema.columns.length) return { ok: false, issues: [{ code: "invalid-schema" }] };
  const normalized = headers.map(normalizeHeader);
  const seen = new Map<string, number>();
  normalized.forEach((header, index) => {
    if (!header) issues.push({ code: "empty", index });
    else if (seen.has(header)) issues.push({ code: "duplicate", index });
    else seen.set(header, index);
  });
  const expected = new Map<string, TabularColumn>();
  const keys = new Set<string>();
  for (const column of schema.columns) {
    const header = normalizeHeader(column.importHeader ?? column.label);
    if (!column.key || keys.has(column.key) || !header || expected.has(header)) return { ok: false, issues: [{ code: "invalid-schema" }] };
    keys.add(column.key);
    expected.set(header, column);
    if (column.required && !seen.has(header)) issues.push({ code: "missing-required", columnKey: column.key });
  }
  normalized.forEach((header, index) => {
    if (header && !expected.has(header) && (schema.unknownHeaders ?? "reject") === "reject") issues.push({ code: "unknown", index });
  });
  if (issues.length) return { ok: false, issues };
  return { ok: true, mapping: new Map([...expected.entries()].flatMap(([header, column]) => {
    const index = seen.get(header);
    return index === undefined ? [] : [[column.key, index] as const];
  })) };
}

export function createImportPreview(document: CsvDocument, schema: TabularSchema): ImportPreviewResult {
  const checked = validateHeaders(document.headers, schema);
  if (!checked.ok) return { ok: false, issue: issue("invalid-headers", checked.issues) };
  let validRows = 0;
  let invalidRows = 0;
  let skippedRows = 0;
  const rows: PreviewRow[] = document.records.map(record => {
    if (record.cells.every(value => !value.trim())) {
      skippedRows++;
      return { rowNumber: record.rowNumber, status: "skipped", fieldErrors: {}, rowErrors: [] };
    }
    const values: Record<string, unknown> = Object.create(null);
    const fieldErrors: Record<string, string[]> = Object.create(null);
    for (const column of schema.columns) {
      const index = checked.mapping.get(column.key);
      const raw = index === undefined ? null : record.cells[index] ?? "";
      if (column.required && (raw === null || !raw.trim())) {
        values[column.key] = raw;
        fieldErrors[column.key] = ["Nilai wajib diisi."];
        continue;
      }
      try {
        const parsed = column.parse ? column.parse(raw) : { ok: true as const, value: raw === null || raw === "" ? null : raw };
        if (!parsed.ok) { values[column.key] = raw; fieldErrors[column.key] = [parsed.message]; continue; }
        const normalized = column.normalize ? column.normalize(parsed.value) : parsed.value;
        values[column.key] = normalized;
        const validation = column.validate?.(normalized, record.rowNumber) ?? null;
        if (validation) { fieldErrors[column.key] = [validation]; continue; }
      } catch {
        values[column.key] = raw;
        fieldErrors[column.key] = ["Nilai tidak dapat diproses."];
      }
    }
    let rowErrors: readonly string[] = [];
    try { rowErrors = schema.validateRow?.(values, record.rowNumber) ?? []; }
    catch { rowErrors = ["Baris tidak dapat divalidasi."]; }
    if (Object.keys(fieldErrors).length || rowErrors.length) {
      invalidRows++;
      return { rowNumber: record.rowNumber, status: "invalid", values, fieldErrors, rowErrors };
    }
    validRows++;
    return { rowNumber: record.rowNumber, status: "valid", values, fieldErrors, rowErrors };
  });
  return { ok: true, preview: { status: "preview", headers: document.headers, rows, totalRows: document.records.length, validRows, invalidRows, skippedRows } };
}

export function previewCsv(text: string, schema: TabularSchema, limits: Partial<TabularLimits> = {}): ImportPreviewResult {
  const parsed = parseCsv(text, limits);
  return parsed.ok ? createImportPreview(parsed.document, schema) : { ok: false, issue: parsed.issue };
}

export function formatHeaderIssues(issues: readonly HeaderIssue[]): readonly string[] {
  return issues.map(item => {
    if (item.code === "invalid-schema") return "Definisi kolom impor belum valid.";
    if (item.code === "missing-required") return "Header wajib tidak ditemukan.";
    if (item.code === "duplicate") return "Ada header yang duplikat.";
    if (item.code === "empty") return "Ada nama header yang kosong.";
    return "Ada header yang tidak dikenal.";
  });
}

export function csvCell(value: unknown, column?: TabularColumn): string {
  if (value === null || value === undefined) return "";
  const numericValue = typeof value === "number";
  let text: string;
  if (column?.serialize) text = column.serialize(value);
  else if (["string", "number", "boolean", "bigint"].includes(typeof value)) {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Unsupported export value");
    text = String(value);
  } else throw new Error("Unsupported export value");
  // Prefix a text marker when the first meaningful character could start a formula.
  const typedNumber = column?.kind === "number" && parseNumber(text).ok;
  if (!numericValue && !typedNumber && /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportCsv<Row extends Readonly<Record<string, unknown>>>(rows: readonly Row[], columns: readonly TabularColumn[], options: { filename: string; bom?: boolean }): DownloadMetadata {
  if (new Set(columns.map(column => column.key)).size !== columns.length) throw new Error("Invalid export columns");
  const lines = [columns.map(column => csvCell(column.exportHeader ?? column.label)).join(",")];
  for (const row of rows) lines.push(columns.map(column => csvCell(Object.hasOwn(row, column.key) ? row[column.key] : null, column)).join(","));
  return { filename: safeFilename(options.filename, "csv"), contentType: "text/csv;charset=utf-8", content: `${options.bom ? "\uFEFF" : ""}${lines.join("\r\n")}\r\n`, rowCount: rows.length };
}

export function createCsvTemplate(columns: readonly TabularColumn[], options: { includeExampleRow?: boolean; bom?: boolean } = {}): string {
  const headers = columns.map(column => csvCell(column.importHeader ?? column.label)).join(",");
  const example = options.includeExampleRow ? `\r\n${columns.map(column => csvCell(column.example ?? "")).join(",")}` : "";
  return `${options.bom ? "\uFEFF" : ""}${headers}${example}\r\n`;
}

export function safeFilename(value: string, extension: "csv" = "csv"): string {
  if (extension !== "csv") throw new Error("Unsupported export extension");
  const safeBase = value.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]+/g, "-").replace(/[^\p{L}\p{N}._ -]+/gu, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^[.\- ]+|[.\- ]+$/g, "").slice(0, 80) || "data-export";
  return `${safeBase}.${extension}`;
}

export const csvAdapter: TabularFormatAdapter<string, CsvParseResult> = {
  format: "csv",
  extension: ".csv",
  mimeTypes: ["text/csv", "application/csv", "application/vnd.ms-excel"],
  parse: parseCsv,
};
export const xlsxAdapter: TabularFormatAdapter<Uint8Array, never> | null = null;
export function supportedImportFormats(): readonly string[] { return [csvAdapter.format]; }
export function xlsxSupportMessage(): string { return "Import dan ekspor XLSX belum didukung. Gunakan CSV UTF-8."; }
export function formatFileIssue(value: ImportIssue): string { return value.message; }
export function isEmptyDisplay(value: unknown): boolean { return value === null || value === undefined || value === "" || value === EMPTY_VALUE; }
