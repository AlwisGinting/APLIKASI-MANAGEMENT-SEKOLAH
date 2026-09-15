import { supabaseFetch } from "./fetch";
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY belum dikonfigurasi di server.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    global: { fetch: supabaseFetch },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getAuthEmails(userIds: string[]) {
  const emailMap = new Map<string, string>();
  if (userIds.length === 0) return emailMap;

  const admin = createAdminClient();
  // Only resolve IDs already verified by the tenant-scoped membership query.
  const ids = [...new Set(userIds)];
  for (let offset = 0; offset < ids.length; offset += 10) {
    const results = await Promise.all(ids.slice(offset, offset + 10).map((id) => admin.auth.admin.getUserById(id)));
    for (const { data, error } of results) {
      if (error) throw new Error("Email pengguna belum tersedia.");
      if (data.user?.email) emailMap.set(data.user.id, data.user.email);
    }
  }
  return emailMap;
}
