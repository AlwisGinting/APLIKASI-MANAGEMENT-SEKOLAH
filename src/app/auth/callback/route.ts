import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { safeNextPath } from "@/lib/redirect";
import { RECOVERY_COOKIE, RECOVERY_MAX_AGE } from "@/lib/recovery";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const nextPath = safeNextPath(params.get("next"));
  const recoveryRequested = nextPath === "/reset-password";
  function go(path: string) {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(RECOVERY_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }
  const failurePath = recoveryRequested ? "/reset-password?error=recovery" : "/login?error=verification";
  const code = params.get("code");
  if (!code || params.has("error")) return go(failurePath);
  try {
    const supabase = await createClient();
    let recovery = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recovery = true;
    });
    const result = await supabase.auth.exchangeCodeForSession(code).finally(() => listener.subscription.unsubscribe());
    const { data, error } = result;
    if (error || !data.session || !data.user) return go(failurePath);
    // Do not infer recovery from an untrusted `next` parameter.
    if (recovery) {
      const response = go("/reset-password");
      response.cookies.set(RECOVERY_COOKIE, data.user.id, {
        httpOnly: true, secure: request.nextUrl.protocol === "https:",
        sameSite: "lax", path: "/", maxAge: RECOVERY_MAX_AGE,
      });
      return response;
    }
    return go(recoveryRequested ? "/reset-password?error=recovery" : nextPath);
  } catch { return go(failurePath); }
}
