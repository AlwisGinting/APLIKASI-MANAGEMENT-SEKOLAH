import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
export const SCHOOL_NAME = "KB DEVFANTA MELATI";

export const APP_ROLES = ["super_admin", "kepala_sekolah", "operator", "guru", "orang_tua"] as const;
export type AppRole = (typeof APP_ROLES)[number];
export const MEMBERSHIP_STATUSES = ["pending", "active", "rejected", "suspended"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export type Membership = {
  id: string;
  school_id: string;
  user_id: string;
  role: AppRole | null;
  status: MembershipStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, profile: null, memberships: [] as Membership[] };

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, avatar_path, created_at, updated_at").eq("id", user.id).maybeSingle(),
    supabase.from("school_memberships").select("id, school_id, user_id, role, status, approved_by, approved_at, created_at, updated_at").eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  return { supabase, user, profile, memberships: (memberships ?? []) as Membership[] };
}

export async function requireUser() {
  const context = await getAuthContext();
  if (!context.user) redirect("/login");
  return context as typeof context & { user: NonNullable<typeof context.user> };
}

export async function requireActiveMembership() {
  const context = await requireUser();
  const membership = context.memberships.find((item) => item.status === "active");
  if (!membership) redirect("/pending-approval");
  return { ...context, membership };
}

export async function requireSchoolAdmin() {
  const context = await requireActiveMembership();
  if (context.membership.role !== "super_admin" && context.membership.role !== "kepala_sekolah") redirect("/dashboard?error=forbidden");
  return context;
}

export async function requireMasterDataAccess() {
  const context = await requireActiveMembership();
  if (!["super_admin", "kepala_sekolah", "operator"].includes(context.membership.role ?? "")) {
    redirect("/dashboard?error=forbidden");
  }
  return context;
}

export async function requireMasterDataViewer() {
  const context = await requireActiveMembership();
  if (!["super_admin", "kepala_sekolah", "operator", "guru"].includes(context.membership.role ?? "")) {
    redirect("/dashboard?error=forbidden");
  }
  return context;
}
