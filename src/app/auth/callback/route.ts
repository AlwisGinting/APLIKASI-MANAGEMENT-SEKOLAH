import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getActiveMembership } from "@/lib/auth";
import { safeNextPath } from "@/lib/redirect";
import { RECOVERY_COOKIE, RECOVERY_MAX_AGE, recoveryFailure } from "@/lib/recovery";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const nextPath = safeNextPath(params.get("next"));
  const recoveryRequested = nextPath === "/reset-password";
  // flow is a display hint, never proof of identity, recovery or authorization.
  const google = params.get("flow") === "google";
  function go(path: string) {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(RECOVERY_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }
  function failure(reason = "recovery-service") {
    return go(recoveryRequested ? `/reset-password?error=${reason}` : google ? "/login?error=oauth" : "/login?error=verification");
  }
  const code = params.get("code");
  if (params.has("error") || params.has("error_code")) return failure(recoveryFailure({ code: params.get("error_code") ?? undefined }));
  // A missing code can also be a provider error returned only in a URL fragment.
  if (!code) return failure();
  if (params.getAll("code").length !== 1) return failure("recovery-invalid");
  const flowId = params.get("sb_flow_id");
  // A malformed explicit ID must never fall back to another flow's verifier.
  if (flowId !== null && (!/^[a-zA-Z0-9_-]{8,64}$/.test(flowId) || params.getAll("sb_flow_id").length !== 1)) return failure("recovery-browser");
  try {
    const supabase = await createClient({ writable: true });
    let recovery = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recovery = true;
    });
    const result = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      .finally(() => listener.subscription.unsubscribe());
    const { data, error } = result;
    if (error) return failure(recoveryFailure(error));
    if (!data.session || !data.user) return failure();
    // The SDK's verifier-bound recovery event is authoritative, not `next`.
    if (recovery) {
      const response = go("/reset-password");
      response.cookies.set(RECOVERY_COOKIE, data.user.id, {
        httpOnly: true, secure: request.nextUrl.protocol === "https:",
        sameSite: "lax", path: "/", maxAge: RECOVERY_MAX_AGE,
      });
      return response;
    }
    if (recoveryRequested) return failure("recovery-invalid");
    if (!(await getActiveMembership())) return go("/pending-approval");
    return go(nextPath);
  } catch { return failure(); }
}
