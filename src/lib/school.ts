import "server-only";
import { cache } from "react";
import { requireCapability } from "@/lib/auth";
import { USER_MESSAGES } from "@/lib/errors";

export const schoolFields = ["address", "phone", "email", "principal_name", "npsn", "description", "vision", "mission", "logo_path"] as const;
export type SchoolDetails = Record<(typeof schoolFields)[number], string | null>;
export const getSchoolContext = cache(async () => {
  const context = await requireCapability("school.read");
  return { ...context, details: context.school as SchoolDetails };
});

export const getOwnFeedback = cache(async () => {
  const context = await requireCapability("feedback.read_own");
  const { data, error } = await context.supabase.from("feedbacks").select("id, title, status, created_at, updated_at").eq("school_id", context.membership.school_id).eq("user_id", context.user.id).order("created_at", { ascending: false }).limit(20);
  if (error?.code === "42P01" || error?.code === "PGRST205") return [];
  if (error) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  return data ?? [];
});
