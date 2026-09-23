"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { authOrigin } from "@/lib/auth-origin";
import { authFailure, field, recoverySent, validateAuthForm, type AuthFormState } from "@/lib/auth-form";

export async function registerAction(_previous: AuthFormState, data: FormData): Promise<AuthFormState> {
  const diagnostic = process.env.NODE_ENV !== "production";
  if (diagnostic) console.info("[auth.register] action invoked");
  const invalid = validateAuthForm("register", data);
  if (invalid) return invalid;
  try {
    const origin = await authOrigin();
    const supabase = await createClient({ writable: true });
    const { data: result, error } = await supabase.auth.signUp({
      email: field(data, "email").trim(), password: field(data, "password"),
      options: { data: { full_name: field(data, "full_name").trim() }, emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
    });
    if (error) {
      const failure = authFailure("register", error);
      // Raw provider messages can contain identifiers. Log only a safe mapping.
      if (diagnostic) console.error("[auth.register]", { code: /^[a-z_]{1,64}$/.test(error.code ?? "") ? error.code : "auth_error", status: error.status, message: failure.message });
      return failure;
    }
    if (diagnostic) console.info("[auth.register] signup accepted", { userCreated: Boolean(result.user), sessionCreated: Boolean(result.session) });
    return { success: true, message: "Permintaan pendaftaran diterima. Periksa email untuk verifikasi, lalu masuk. Akses sekolah menunggu persetujuan administrator." };
  } catch {
    if (diagnostic) console.error("[auth.register]", { code: "service_unavailable" });
    return authFailure("register");
  }
}

export async function loginAction(_previous: AuthFormState, data: FormData): Promise<AuthFormState> {
  const invalid = validateAuthForm("login", data);
  if (invalid) return invalid;
  try {
    const supabase = await createClient({ writable: true });
    const { error } = await supabase.auth.signInWithPassword({ email: field(data, "email").trim(), password: field(data, "password") });
    if (error) return authFailure("login", error);
  } catch { return authFailure("login"); }
  // Next's redirect throws internally and must stay outside catch.
  redirect("/dashboard");
}

export async function forgotPasswordAction(_previous: AuthFormState, data: FormData): Promise<AuthFormState> {
  const invalid = validateAuthForm("forgot", data);
  if (invalid) return invalid;
  try {
    const origin = await authOrigin();
    const supabase = await createClient({ writable: true });
    const { error } = await supabase.auth.resetPasswordForEmail(field(data, "email").trim(), { redirectTo: `${origin}/auth/callback?next=/reset-password` });
    if (error && (!error.status || error.status >= 500)) return authFailure("forgot", error);
    return { success: true, message: recoverySent };
  } catch { return authFailure("forgot"); }
}
