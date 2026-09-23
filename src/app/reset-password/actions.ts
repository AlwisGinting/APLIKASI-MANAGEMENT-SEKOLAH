"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { authFailure, field, validateAuthForm, type AuthFormState } from "@/lib/auth-form";
import { RECOVERY_COOKIE, RECOVERY_ERROR, RECOVERY_SERVICE_ERROR } from "@/lib/recovery";


export async function resetPasswordAction(_previous: AuthFormState, data: FormData): Promise<AuthFormState> {
  const invalid = validateAuthForm("reset", data);
  if (invalid) return invalid;
  const password = field(data, "password");
  try {
    const store = await cookies();
    const marker = store.get(RECOVERY_COOKIE)?.value;
    if (!marker) return { success: false, message: RECOVERY_ERROR };
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error && (!error.status || error.status >= 500)) return { success: false, message: RECOVERY_SERVICE_ERROR };
    if (error || !user || marker !== user.id) return { success: false, message: RECOVERY_ERROR };
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) return authFailure("reset", updateError);
    store.delete(RECOVERY_COOKIE);
    // Local logout is sufficient; do not report the committed password update
    // as failed if remote session revocation is temporarily unavailable.
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* cookies cleared below */ }
    const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
    for (const cookie of store.getAll()) {
      if (cookie.name === storageKey || cookie.name.startsWith(`${storageKey}.`)) store.delete(cookie.name);
    }
    // Redirect below, before cookie invalidation can rerender the gated reset page.
  } catch { return { success: false, message: RECOVERY_SERVICE_ERROR }; }
  redirect("/login?reset=success");
}
