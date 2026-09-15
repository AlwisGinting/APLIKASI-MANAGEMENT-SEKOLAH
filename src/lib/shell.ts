import { hasCapability } from "@/lib/capabilities";
import type { AppRole } from "@/config/app";
export const roleLabels: Record<AppRole, string> = { super_admin: "Super admin", kepala_sekolah: "Kepala sekolah", operator: "Operator", guru: "Guru", orang_tua: "Orang tua/wali" };
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("id-ID") || "U"; }
export function dateLabel(value?: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Belum tersedia";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)) + " WIB";
}
export function canManageSchool(role: AppRole | null) { return hasCapability({ membership: { role, status: "active" } }, "school.update"); }
export function canViewSchool(role: AppRole | null) { return hasCapability({ membership: { role, status: "active" } }, "school.read"); }

export const membershipLabels: Record<string, string> = { active: "Aktif", pending: "Menunggu persetujuan", rejected: "Ditolak", suspended: "Ditangguhkan" };
