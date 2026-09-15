import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { RECOVERY_COOKIE, RECOVERY_ERROR } from "@/lib/recovery";
import { USER_MESSAGES } from "@/lib/errors";
import { ResetPasswordForm } from "./reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ code?: string; error?: string }> }) {
  const params = await searchParams;
  // Previously sent PKCE emails used this URL directly.
  if (params.code && !params.error) redirect(`/auth/callback?next=/reset-password&code=${encodeURIComponent(params.code)}`);
  if (params.error) return <ResetPasswordForm initialError={RECOVERY_ERROR} />;
  let initialError = RECOVERY_ERROR;
  let ready = false;
  try {
    const marker = (await cookies()).get(RECOVERY_COOKIE)?.value;
    if (marker) {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error && (!error.status || error.status >= 500)) initialError = USER_MESSAGES.SERVICE_UNAVAILABLE;
      else if (!error && user && marker === user.id) { ready = true; initialError = ""; }
    }
  } catch { initialError = USER_MESSAGES.SERVICE_UNAVAILABLE; }
  return <ResetPasswordForm ready={ready} initialError={initialError} />;
}
