import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY belum dikonfigurasi di server.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
