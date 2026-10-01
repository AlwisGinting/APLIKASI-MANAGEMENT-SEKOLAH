import { calendarDate, EMPTY_VALUE } from "@/lib/data-format";

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
const invalid = <T>(message: string): Parsed<T> => ({ ok: false, message });
// Read a scalar without converting files, merging duplicates or trimming it.
// Password callers may use this raw value; never return it in action results.
export function readSingleText(data: FormData, name: string): Parsed<string | null> {
  const values = data.getAll(name);
  if (!values.length) return { ok: true, value: null };
  if (values.length !== 1 || typeof values[0] !== "string") return invalid("Isian tidak valid.");
  return { ok: true, value: values[0] };
}
export function normalText(value: string): string { return value.trim(); }
export function optionalText(value: string | null): string | null { return value?.trim() || null; }
// Preserve the local part: mailbox canonicalization is a domain-specific rule.
export function normalizeEmail(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf("@");
  return at < 0 ? trimmed : trimmed.slice(0, at + 1) + trimmed.slice(at + 1).toLowerCase();
}
function normalizedDecimal(value: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const integer = match[2].replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? "").replace(/0+$/, "");
  if (!/[1-9]/.test(integer + fraction)) return "0";
  return `${match[1] === "-" ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
}
function numberDecimal(value: number): string {
  const source = value.toString().toLowerCase();
  const [mantissa, exponentText] = source.split("e");
  if (exponentText === undefined) return normalizedDecimal(mantissa);
  const exponent = Number(exponentText);
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const point = unsigned.indexOf(".");
  const digits = unsigned.replace(".", "");
  const position = (point < 0 ? unsigned.length : point) + exponent;
  const expanded = position <= 0
    ? `0.${"0".repeat(-position)}${digits}`
    : position >= digits.length
      ? `${digits}${"0".repeat(position - digits.length)}`
      : `${digits.slice(0, position)}.${digits.slice(position)}`;
  return normalizedDecimal(`${negative ? "-" : ""}${expanded}`);
}
export function parseNumber(value: string | null): Parsed<number | null> {
  if (value === null || !value.trim()) return { ok: true, value: null };
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return invalid("Masukkan angka yang valid.");
  const number = Number(text);
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER) return invalid("Angka berada di luar batas yang didukung.");
  const normalizedInput = text.replace(/^([+-]?)\./, (_match, sign: string) => `${sign}0.`);
  if (normalizedDecimal(normalizedInput) !== numberDecimal(number)) {
    return invalid("Angka memiliki presisi di luar batas yang didukung.");
  }
  return { ok: true, value: number };
}
export function parseCheckbox(data: FormData, name: string): Parsed<boolean> {
  const read = readSingleText(data, name);
  if (!read.ok) return read;
  if (read.value === null) return { ok: true, value: false };
  return read.value === "on" ? { ok: true, value: true } : invalid("Pilihan tidak valid.");
}
export function parseCalendarDate(value: string | null): Parsed<string | null> {
  if (value === null || !value.trim()) return { ok: true, value: null };
  return calendarDate(value) === EMPTY_VALUE ? invalid("Masukkan tanggal yang valid.") : { ok: true, value };
}

export type FieldErrors<Field extends string = string> = Partial<Record<Field, readonly string[]>>;
export type ValidationResult<Value, Field extends string = string> =
  | { ok: true; value: Value }
  | { ok: false; fieldErrors: FieldErrors<Field>; formError?: string };
// Messages must be developer-authored safe copy, never exception/input text.
export function validated<Value, Field extends string>(value: Value, fieldErrors: FieldErrors<Field>, formError?: string): ValidationResult<Value, Field> {
  return formError || Object.values<readonly string[] | undefined>(fieldErrors).some(errors => errors?.length)
    ? { ok: false, fieldErrors, ...(formError ? { formError } : {}) } : { ok: true, value };
}
export type MutationResult<Field extends string = string> =
  | { status: "success"; message: string }
  | { status: "validation"; message: string; fieldErrors: FieldErrors<Field> }
  | { status: "error"; message: string };
export function mutationSuccess(): MutationResult { return { status: "success", message: "Data berhasil disimpan." }; }
export function mutationInvalid<Field extends string>(result: Extract<ValidationResult<unknown, Field>, { ok: false }>): MutationResult<Field> {
  return { status: "validation", message: result.formError || "Periksa kembali isian yang ditandai.", fieldErrors: result.fieldErrors };
}
export function mutationFailure(): MutationResult { return { status: "error", message: "Data belum dapat disimpan. Silakan coba kembali." }; }
