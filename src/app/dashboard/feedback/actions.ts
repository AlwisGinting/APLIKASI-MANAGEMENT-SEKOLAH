"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveMembership } from "@/lib/auth";

const FEEDBACK_PATH = "/dashboard/feedback";
const TYPES = ["suggestion", "bug", "complaint", "other"] as const;
const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function submitFeedback(_previousState: { success: boolean; error: string }, formData: FormData) {
  const context = await requireActiveMembership();
  const type = text(formData, "type");
  const title = text(formData, "title");
  const message = text(formData, "message");
  const currentPath = text(formData, "current_path").slice(0, 1000) || null;
  if (!TYPES.includes(type as (typeof TYPES)[number]) || !title || title.length > 200 || !message || message.length > 5000) return { success: false, error: "Lengkapi judul dan pesan dengan benar." };
  const { error } = await context.supabase.from("feedbacks").insert({
    school_id: context.membership.school_id,
    user_id: context.user.id,
    type,
    title,
    message,
    current_path: currentPath,
    status: "open",
  });
  if (error) return { success: false, error: "Feedback belum dapat dikirim. Coba lagi." };
  revalidatePath(FEEDBACK_PATH);
  return { success: true, error: "" };
}

export async function updateFeedbackStatus(formData: FormData) {
  const context = await requireActiveMembership();
  if (context.membership.role !== "super_admin" && context.membership.role !== "kepala_sekolah") redirect(`${FEEDBACK_PATH}?error=forbidden`);
  const id = text(formData, "id"); const status = text(formData, "status");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) redirect(`${FEEDBACK_PATH}?error=validation`);
  const { error } = await context.supabase.from("feedbacks").update({ status }).eq("id", id).eq("school_id", context.membership.school_id);
  if (error) redirect(`${FEEDBACK_PATH}?error=update`);
  revalidatePath(FEEDBACK_PATH); redirect(`${FEEDBACK_PATH}?success=updated`);
}
