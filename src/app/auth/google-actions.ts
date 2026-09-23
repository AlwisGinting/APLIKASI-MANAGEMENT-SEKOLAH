"use server";

import { redirect } from "next/navigation";
import { authOrigin } from "@/lib/auth-origin";
import { createClient } from "@/utils/supabase/server";
import type { AuthFormState } from "@/lib/auth-form";

export async function googleLoginAction(): Promise<AuthFormState> {
  let destination: string;
  try {
    const origin = await authOrigin();
    // Explicit deployed/local origins; never accept callback URLs from form data.
    if (!["https://aplikasi-management-sekolah.vercel.app", "http://localhost:3000"].includes(origin)) throw new Error("Invalid origin");
    const supabase = await createClient({ writable: true });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard&flow=google`,
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw new Error("OAuth unavailable");
    const url = new URL(data.url);
    const endpoint = new URL("/auth/v1/authorize", process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (url.origin !== endpoint.origin || url.pathname !== endpoint.pathname || url.username || url.password || url.searchParams.get("provider") !== "google") throw new Error("Invalid destination");
    destination = url.href;
  } catch {
    return { success: false, message: "Masuk dengan Google belum dapat diproses. Silakan coba kembali atau gunakan email dan kata sandi." };
  }
  redirect(destination);
}
