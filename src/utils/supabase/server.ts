import { supabaseFetch } from "./fetch";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient({ writable = false }: { writable?: boolean } = {}) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { fetch: supabaseFetch },
      auth: { experimental: { appendPkceFlowIdToRedirects: true } },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch (error) {
            if (writable) throw error;
            // Server Components cannot always mutate cookies; proxy refreshes the session.
          }
        },
      },
    },
  );
}
