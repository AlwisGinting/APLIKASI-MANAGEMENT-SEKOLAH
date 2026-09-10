"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APP_ROLES, MEMBERSHIP_STATUSES, SCHOOL_ID, requireSchoolAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateMembership(formData: FormData) {
  const context = await requireSchoolAdmin();
  const membershipId = String(formData.get("membership_id") ?? "");
  const nextStatus = String(formData.get("status") ?? "");
  const roleValue = String(formData.get("role") ?? "");
  if (!membershipId || !MEMBERSHIP_STATUSES.includes(nextStatus as (typeof MEMBERSHIP_STATUSES)[number])) redirect("/dashboard/users?error=input");
  if (nextStatus === "active" && !APP_ROLES.includes(roleValue as (typeof APP_ROLES)[number])) redirect("/dashboard/users?error=role");

  const role = APP_ROLES.includes(roleValue as (typeof APP_ROLES)[number]) ? roleValue : null;
  const { error } = await context.supabase.from("school_memberships").update({
    status: nextStatus,
    role,
    approved_by: nextStatus === "active" ? context.user.id : null,
    approved_at: nextStatus === "active" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", membershipId).eq("school_id", SCHOOL_ID);

  if (error) redirect("/dashboard/users?error=update");
  revalidatePath("/dashboard/users");
  redirect("/dashboard/users?success=updated");
}
