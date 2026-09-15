"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/auth";
import { feedbackPath, feedbackTableMissing, feedbackUnavailable } from "@/lib/feedback";
import { APP_CONFIG } from "@/config/app";

const FEEDBACK_PATH = APP_CONFIG.routes.feedback;
const TYPES = ["suggestion", "bug", "complaint", "other"] as const;
const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function submitFeedback(_previousState: { success: boolean; error: string }, formData: FormData) {
  const context = await requireCapability("feedback.create");
  const type = text(formData, "type");
  const title = text(formData, "title");
  const message = text(formData, "message");
  const currentPath = feedbackPath(formData.get("current_path"));
  if (!TYPES.includes(type as (typeof TYPES)[number]) || !title || title.length > APP_CONFIG.feedback.titleMaxLength || !message || message.length > APP_CONFIG.feedback.messageMaxLength) return { success: false, error: "Lengkapi judul dan pesan dengan benar." };
  const { error } = await context.supabase.from("feedbacks").insert({
    school_id: context.membership.school_id,
    user_id: context.user.id,
    type,
    title,
    message,
    current_path: currentPath,
    status: "open",
  });
  if (error) return { success: false, error: feedbackTableMissing(error) ? feedbackUnavailable : "Feedback belum dapat dikirim. Coba lagi." };
  revalidatePath(FEEDBACK_PATH);
  return { success: true, error: "" };
}

export async function updateFeedbackStatus(formData: FormData) {
  const context = await requireCapability("feedback.manage");
  const id = text(formData, "id"); const status = text(formData, "status");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) redirect(`${FEEDBACK_PATH}?error=validation`);
  const { data: saved, error } = await context.supabase.from("feedbacks").update({ status }).eq("id", id).eq("school_id", context.membership.school_id).select("id").maybeSingle();
  if (error || !saved) redirect(`${FEEDBACK_PATH}?error=update`);
  revalidatePath(FEEDBACK_PATH); redirect(`${FEEDBACK_PATH}?success=updated`);
}
