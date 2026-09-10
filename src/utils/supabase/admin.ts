import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY belum dikonfigurasi di server.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getAuthEmails(userIds: string[]) {
  const emailMap = new Map<string, string>();
  if (userIds.length === 0) return emailMap;

  const admin = createAdminClient();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email && userIds.includes(user.id)) emailMap.set(user.id, user.email);
    }
    if (data.users.length < perPage || userIds.every((userId) => emailMap.has(userId))) break;
    page += 1;
  }

  return emailMap;
}
