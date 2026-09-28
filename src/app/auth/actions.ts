"use server";

import { cookies } from "next/headers";
import { RECOVERY_COOKIE } from "@/lib/recovery";
import { USER_MESSAGES } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APP_ROLES, MEMBERSHIP_STATUSES, requireCapability } from "@/lib/auth";
import { hasCapability } from "@/lib/capabilities";
import { createClient } from "@/utils/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  (await cookies()).delete(RECOVERY_COOKIE);
  redirect("/login");
}

export async function updateMembership(formData: FormData) {
  const context = await requireCapability("users.manage");
  const membershipId = String(formData.get("membership_id") ?? "");
  const nextStatus = String(formData.get("status") ?? "");
  const roleValue = String(formData.get("role") ?? "");
  if (!membershipId || !MEMBERSHIP_STATUSES.includes(nextStatus as (typeof MEMBERSHIP_STATUSES)[number])) redirect("/dashboard/users?error=input");
  if (roleValue && !APP_ROLES.includes(roleValue as (typeof APP_ROLES)[number])) redirect("/dashboard/users?error=role");

  const { data: targetMembership, error: targetError } = await context.supabase
    .from("school_memberships")
    .select("id, user_id, role, status")
    .eq("id", membershipId)
    .eq("school_id", context.membership.school_id)
    .maybeSingle();
  if (targetError || !targetMembership) redirect("/dashboard/users?error=not-found");
  const role = APP_ROLES.includes(roleValue as (typeof APP_ROLES)[number]) ? roleValue : null;
  const canManageSuperAdmins = hasCapability(context, "users.manage_super_admin");
  if ((targetMembership.role === "super_admin" || role === "super_admin") && !canManageSuperAdmins) redirect("/dashboard/users?error=super-admin-only");
  const isSelf = targetMembership.user_id === context.user.id;
  if (isSelf && !(canManageSuperAdmins && targetMembership.role === "super_admin")) redirect("/dashboard/users?error=self");
  const removesSuperAdmin = targetMembership.status === "active" && targetMembership.role === "super_admin"
    && (nextStatus !== "active" || role !== "super_admin");
  if (removesSuperAdmin) {
    // UX precheck only. Draft 008 is the transactional database authority.
    const { count, error: countError } = await context.supabase
      .from("school_memberships")
      .select("id", { count: "exact", head: true })
      .eq("school_id", context.membership.school_id)
      .eq("status", "active")
      .eq("role", "super_admin");
    if (countError || (count ?? 0) <= 1) redirect("/dashboard/users?error=last-super-admin");
  }

  const { data: saved, error } = await context.supabase.from("school_memberships").update({
    status: nextStatus,
    role,
    approved_by: nextStatus === "active" ? context.user.id : null,
    approved_at: nextStatus === "active" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", membershipId).eq("school_id", context.membership.school_id).select("id").maybeSingle();

  if (error || !saved) {
    const reason = error?.code === "P8001" ? "last-super-admin"
      : error?.code === "P8002" ? "super-admin-only"
      : error?.code === "40001" || error?.code === "40P01" ? "concurrent-change" : "update";
    redirect(`/dashboard/users?error=${reason}`);
  }
  revalidatePath("/dashboard/users");
  if (isSelf) redirect("/dashboard");
  redirect("/dashboard/users?success=updated");
}
