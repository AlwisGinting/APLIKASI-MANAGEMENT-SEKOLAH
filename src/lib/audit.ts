import "server-only";
import { cache } from "react";
import { requireCapability } from "@/lib/auth";
import { USER_MESSAGES } from "@/lib/errors";

export type AuditEvent = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
  actorLabel: string;
};
export const getTenantAudit = cache(async (): Promise<{ available: boolean; events: AuditEvent[] }> => {
  const context = await requireCapability("audit.read");
  const { data, error } = await context.supabase.from("audit_logs")
    .select("id, actor_user_id, action, entity_type, entity_id, metadata, created_at")
    .eq("school_id", context.membership.school_id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
  // Only missing-relation/schema-cache errors indicate unapplied 007.
  if (error?.code === "42P01" || error?.code === "PGRST205") return { available: false, events: [] };
  if (error) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  const events = (data ?? []) as Omit<AuditEvent, "actorLabel">[];
  const actorIds = [...new Set(events.flatMap((event) => event.actor_user_id ? [event.actor_user_id] : []))];
  const { data: profiles, error: profileError } = actorIds.length
    ? await context.supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [], error: null };
  if (profileError) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  // Ordinary authenticated client/RLS only; names may be unavailable after deletion
  // or membership changes. Audit stores no copied personal names or email addresses.
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  return { available: true, events: events.map((event) => ({
    ...event,
    actorLabel: event.actor_user_id === null ? "Sistem" : names.get(event.actor_user_id) ?? "Pengguna (nama tidak tersedia)",
  })) };
});
