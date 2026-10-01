import { dateLabel } from "@/lib/shell";
export const EMPTY_VALUE = "Belum diisi";
// Date-only values are calendar dates, never converted through a local timezone.
export function calendarDate(value?: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return EMPTY_VALUE;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return EMPTY_VALUE;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
// Require an explicit offset for instants; reuse the existing WIB formatter.
export function dateTime(value?: string | null): string {
  if (!value || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) return EMPTY_VALUE;
  return dateLabel(value);
}
