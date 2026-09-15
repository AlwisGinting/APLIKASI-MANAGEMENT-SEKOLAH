export type AuthMode = "register" | "login" | "forgot" | "reset";
export type AuthField = "full_name" | "email" | "password" | "confirmation";
export type AuthFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
};
export const initialAuthState: AuthFormState = { success: false, message: "" };
export const unavailable = "Layanan sedang tidak tersedia. Silakan coba kembali beberapa saat lagi.";
export const recoverySent = "Jika email terdaftar, tautan pemulihan akan dikirim.";

export function field(data: FormData, name: AuthField) {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

export function validateAuthForm(mode: AuthMode, data: FormData): AuthFormState | null {
  const fieldErrors: NonNullable<AuthFormState["fieldErrors"]> = {};
  const email = field(data, "email").trim();
  const password = field(data, "password");
  if (mode === "register" && (!field(data, "full_name").trim() || field(data, "full_name").trim().length > 150)) fieldErrors.full_name = "Isi nama lengkap, maksimal 150 karakter.";
  if (mode !== "reset" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) fieldErrors.email = "Masukkan alamat email yang valid.";
  if (mode !== "forgot" && !password) fieldErrors.password = "Kata sandi wajib diisi.";
  if ((mode === "register" || mode === "reset") && password.length < 8) fieldErrors.password = "Kata sandi minimal 8 karakter.";
  if ((mode === "register" || mode === "reset") && password !== field(data, "confirmation")) fieldErrors.confirmation = "Konfirmasi kata sandi tidak sama.";
  return Object.keys(fieldErrors).length ? { success: false, message: "Periksa kembali bagian yang ditandai.", fieldErrors } : null;
}

export function authFailure(mode: AuthMode, error?: { status?: number; code?: string } | null): AuthFormState {
  let message = unavailable;
  if (error?.status && error.status < 500) {
    if (mode === "login") message = "Belum dapat masuk. Periksa email dan kata sandi, serta pastikan verifikasi email sudah selesai.";
    else if (error.status === 429) message = "Terlalu banyak percobaan. Silakan tunggu beberapa saat sebelum mencoba kembali.";
    else if (mode === "register") message = "Pendaftaran belum dapat diproses. Periksa isian atau coba masuk jika Anda pernah mendaftar.";
    else if (mode === "reset") message = "Kata sandi belum dapat diperbarui. Gunakan kata sandi lain atau minta tautan pemulihan baru.";
  }
  return { success: false, message };
}
