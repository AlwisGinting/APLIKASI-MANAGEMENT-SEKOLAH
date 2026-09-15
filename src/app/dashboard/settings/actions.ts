"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability, requireUser } from "@/lib/auth";
import { getSchoolContext } from "@/lib/school";
import { APP_CONFIG } from "@/config/app";
import { RECOVERY_COOKIE } from "@/lib/recovery";
import { USER_MESSAGES } from "@/lib/errors";
import { profileInput, schoolInput, textField, type SettingsState } from "@/lib/settings";
const R = APP_CONFIG.routes;
const failed: SettingsState = { success: false, message: USER_MESSAGES.SERVICE_UNAVAILABLE };

export async function saveProfile(_previous: SettingsState, data: FormData): Promise<SettingsState> {
  const context = await requireCapability("profile.update_self");
  const { payload, fieldErrors } = profileInput(data);
  if (Object.keys(fieldErrors).length) return { success: false, message: "Periksa isian profil Anda.", fieldErrors };
  const { data: saved, error } = await context.supabase.from("profiles").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", context.user.id).select("id").maybeSingle();
  if (error || !saved) return failed;
  revalidatePath(R.dashboard, "layout");
  return { success: true, message: "Profil berhasil diperbarui." };
}

export async function saveSchool(_previous: SettingsState, data: FormData): Promise<SettingsState> {
  const context = await requireCapability("school.update");
  const { payload, fieldErrors } = schoolInput(data);
  if (Object.keys(fieldErrors).length) return { success: false, message: "Periksa isian profil sekolah.", fieldErrors };
  const { details } = await getSchoolContext();
  if (!details) return { success: false, message: "Pengaturan profil sekolah belum tersedia. Hubungi pengelola aplikasi." };
  const { data: saved, error } = await context.supabase.from("schools").update(payload).eq("id", context.membership.school_id).select("id").maybeSingle();
  if (error || !saved) return failed;
  revalidatePath(R.dashboard, "layout");
  return { success: true, message: "Profil sekolah berhasil diperbarui." };
}

export async function changePassword(_previous: SettingsState, data: FormData): Promise<SettingsState> {
  const context = await requireCapability("profile.update_self");
  const password = data.get("password");
  const current = data.get("current_password");
  const confirmation = data.get("confirmation");
  const fieldErrors: Record<string, string> = {};
  if (typeof current !== "string" || !current) fieldErrors.current_password = "Kata sandi saat ini wajib diisi.";
  if (typeof password !== "string" || password.length < 8) fieldErrors.password = "Kata sandi baru minimal 8 karakter.";
  if (password !== confirmation) fieldErrors.confirmation = "Konfirmasi kata sandi tidak sama.";
  if (Object.keys(fieldErrors).length) return { success: false, message: "Periksa kata sandi Anda.", fieldErrors };
  const { error } = await context.supabase.auth.updateUser({ password: password as string, current_password: current as string });
  if (error) return { success: false, message: "Kata sandi belum dapat diperbarui. Periksa kata sandi saat ini, gunakan kata sandi baru yang kuat, atau gunakan pemulihan akun." };
  (await cookies()).delete(RECOVERY_COOKIE);
  return { success: true, message: "Kata sandi berhasil diperbarui. Anda dapat keluar dari semua sesi di bawah jika diperlukan." };
}

export async function saveAppearance(_previous: SettingsState, data: FormData): Promise<SettingsState> {
  await requireCapability("profile.update_self");
  const theme = textField(data, "theme");
  if (!["system", "light", "dark"].includes(theme)) return { success: false, message: "Pilih tema yang tersedia." };
  const store = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/dashboard", maxAge: 60 * 60 * 24 * 365 };
  store.set("school-ui-theme", theme, options);
  store.set("school-ui-compact", data.get("compact") === "on" ? "true" : "false", options);
  revalidatePath(R.dashboard, "layout");
  return { success: true, message: "Preferensi tampilan disimpan untuk browser ini." };
}

export async function logoutSession() {
  const context = await requireUser();
  const { error } = await context.supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  (await cookies()).delete(RECOVERY_COOKIE);
  redirect(R.login);
}
export async function logoutAll(_previous: SettingsState, data: FormData): Promise<SettingsState> {
  const context = await requireUser();
  if (data.get("confirm") !== "on") return { success: false, message: "Centang konfirmasi untuk keluar dari semua sesi." };
  const { error } = await context.supabase.auth.signOut({ scope: "global" });
  if (error) return failed;
  (await cookies()).delete(RECOVERY_COOKIE);
  redirect(R.login);
}
