export type SettingsState = { success: boolean; message: string; fieldErrors?: Record<string, string> };
export const settingsInitial: SettingsState = { success: false, message: "" };
export function textField(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" ? value.trim() : ""; }
export function profileInput(data: FormData) {
  const full_name = textField(data, "full_name");
  const phone = textField(data, "phone");
  const fieldErrors: Record<string, string> = {};
  if (!full_name || full_name.length > 150) fieldErrors.full_name = "Nama wajib diisi, maksimal 150 karakter.";
  if (phone && (!/^[+\d\s().-]+$/.test(phone) || phone.length > 40)) fieldErrors.phone = "Nomor telepon tidak valid (maksimal 40 karakter).";
  return { payload: { full_name, phone: phone || null }, fieldErrors };
}
export const editableSchoolFields = ["name", "address", "phone", "email", "principal_name", "npsn", "description", "vision", "mission"] as const;
export function schoolInput(data: FormData) {
  const payload = Object.fromEntries(editableSchoolFields.map((key) => [key, textField(data, key) || null])) as Record<(typeof editableSchoolFields)[number], string | null>;
  const fieldErrors: Record<string, string> = {};
  for (const key of editableSchoolFields) {
    const limit = ["description", "vision", "mission"].includes(key) ? 3000 : key === "address" ? 1000 : key === "email" ? 254 : key === "phone" ? 40 : 200;
    if ((payload[key]?.length ?? 0) > limit) fieldErrors[key] = `Maksimal ${limit} karakter.`;
  }
  if (!payload.name) fieldErrors.name = "Nama sekolah wajib diisi.";
  if (payload.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.email.length > 254)) fieldErrors.email = "Email sekolah tidak valid.";
  if (payload.npsn && !/^\d{8}$/.test(payload.npsn)) fieldErrors.npsn = "NPSN harus terdiri dari 8 angka, atau kosongkan.";
  return { payload, fieldErrors };
}
