import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { RECOVERY_COOKIE, RECOVERY_SERVICE_ERROR, recoveryMessage } from "@/lib/recovery";
import { ResetPasswordForm } from "./reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ code?: string; error?: string; sb_flow_id?: string }> }) {
  const params = await searchParams;
  // Preserve the SDK flow correlation on older email callback URLs as well.
  if (params.code && !params.error) {
    const query = new URLSearchParams({ next: "/reset-password", code: params.code });
    if (params.sb_flow_id !== undefined) query.set("sb_flow_id", params.sb_flow_id);
    redirect(`/auth/callback?${query}`);
  }
  let initialError = recoveryMessage(params.error);
  let ready = false;
  try {
    const marker = (await cookies()).get(RECOVERY_COOKIE)?.value;
    if (marker) {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user || marker !== user.id) initialError = RECOVERY_SERVICE_ERROR;
      else { ready = true; initialError = ""; }
    }
  } catch { initialError = RECOVERY_SERVICE_ERROR; }
  return <ResetPasswordForm ready={ready} initialError={initialError} />;
}
