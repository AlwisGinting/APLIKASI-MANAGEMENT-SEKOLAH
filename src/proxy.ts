import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseFetch } from "@/utils/supabase/fetch";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  // Callback owns code exchange; do not refresh an older session before PKCE.
  if (request.nextUrl.pathname === "/auth/callback") return response;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { fetch: supabaseFetch },
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previous = response;
        response = NextResponse.next({ request });
        for (const name of ["Cache-Control", "Expires", "Pragma"]) {
          const value = previous.headers.get(name);
          if (value) response.headers.set(name, value);
        }
        previous.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  // Server helpers perform authorization. A backend outage must not stop public
  // auth forms from rendering, and must not erase a potentially valid session.
  try { await supabase.auth.getUser(); } catch { /* server pages show safe errors */ }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/pending-approval", "/login", "/register", "/forgot-password", "/reset-password", "/auth/:path*"],
};
