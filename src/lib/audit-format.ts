// Presentation-only allowlists. Never render raw metadata, arbitrary actions, or row snapshots.
export const auditActionLabels: Record<string, string> = {
  "profile.updated": "Profil diperbarui",
  "school.updated": "Profil sekolah diperbarui",
  "membership.approved": "Membership diaktifkan",
  "membership.rejected": "Membership ditolak",
  "membership.suspended": "Membership ditangguhkan",
  "membership.updated": "Membership diperbarui",
  "membership.role_changed": "Role membership diubah",
  "academic_year.created": "Tahun ajaran dibuat",
  "academic_year.updated": "Tahun ajaran diperbarui",
  "academic_year.activated": "Tahun ajaran diaktifkan",
  "academic_year.deactivated": "Tahun ajaran dinonaktifkan",
  "academic_year.deleted": "Tahun ajaran dihapus",
  "semester.created": "Semester dibuat",
  "semester.updated": "Semester diperbarui",
  "semester.activated": "Semester diaktifkan",
  "semester.deactivated": "Semester dinonaktifkan",
  "semester.deleted": "Semester dihapus",
  "classroom.created": "Kelas dibuat",
  "classroom.updated": "Kelas diperbarui",
  "classroom.deleted": "Kelas dihapus",
  "feedback.created": "Feedback dibuat",
  "feedback.status_changed": "Status feedback diubah",
  "feedback.deleted": "Feedback dihapus",
};
const entities: Record<string, string> = { profile: "Profil", school: "Sekolah", membership: "Membership", academic_year: "Tahun ajaran", semester: "Semester", classroom: "Kelas", feedback: "Feedback" };
const fields: Record<string, string> = {
  full_name: "Nama", phone: "Telepon", avatar_path: "Foto profil", name: "Nama", address: "Alamat", email: "Email", principal_name: "Kepala sekolah", npsn: "NPSN", description: "Deskripsi", vision: "Visi", mission: "Misi", logo_path: "Logo", status: "Status", role: "Role", start_date: "Tanggal mulai", end_date: "Tanggal selesai", is_active: "Keaktifan", academic_year_id: "Tahun ajaran", code: "Kode", level: "Tingkat", capacity: "Kapasitas",
};
const statuses: Record<string, string> = { active: "Aktif", approved: "Disetujui", pending: "Menunggu", rejected: "Ditolak", suspended: "Ditangguhkan", open: "Terbuka", in_progress: "Diproses", resolved: "Selesai", closed: "Ditutup" };
const roles: Record<string, string> = { super_admin: "Super admin", kepala_sekolah: "Kepala sekolah", operator: "Operator", guru: "Guru", orang_tua: "Orang tua/wali" };
function label(labels: Record<string, string>, value: unknown, fallback: string) {
  return typeof value === "string" && Object.hasOwn(labels, value) ? labels[value] : fallback;
}
export function auditActionLabel(action: string) { return label(auditActionLabels, action, "Perubahan tercatat"); }
export function auditEntityLabel(entity: string) { return label(entities, entity, "Entitas"); }
export function auditMetadataLines(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const metadata = value as Record<string, unknown>;
  const lines: string[] = [];
  if (Array.isArray(metadata.changed_fields)) {
    const changed = [...new Set(metadata.changed_fields.filter((key): key is string => typeof key === "string" && Object.hasOwn(fields, key)))].slice(0, 25);
    if (changed.length) lines.push(`Kolom diubah: ${changed.map((key) => fields[key]).join(", ")}.`);
  }
  for (const [prefix, labels, title] of [["status", statuses, "Status"], ["role", roles, "Role"]] as const) {
    if (Object.hasOwn(metadata, `old_${prefix}`) && Object.hasOwn(metadata, `new_${prefix}`)) {
      const previous = metadata[`old_${prefix}`];
      const next = metadata[`new_${prefix}`];
      lines.push(`${title}: ${previous === null ? "Belum ditetapkan" : label(labels, previous, "Tidak tersedia")} → ${next === null ? "Belum ditetapkan" : label(labels, next, "Tidak tersedia")}.`);
    }
  }
  return lines;
}
