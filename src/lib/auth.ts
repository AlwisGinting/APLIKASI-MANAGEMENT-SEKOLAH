import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { hasCapability, type Capability } from "@/lib/capabilities";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { APP_CONFIG, AUTH_ROLES, type AppRole, type MembershipStatus } from "@/config/app";
import { ERROR_CODES, USER_MESSAGES } from "@/lib/errors";

export const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
export const SCHOOL_NAME = APP_CONFIG.name.replace("SIM ", "");

export const APP_ROLES = AUTH_ROLES;
export { MEMBERSHIP_STATUSES } from "@/config/app";
export type { AppRole, MembershipStatus } from "@/config/app";

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

// React cache deduplicates only within a server render, never across users.
export const getAuthContext = cache(async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && (!error.status || error.status >= 500) && error.name !== "AuthSessionMissingError") throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  if (error || !user) return { supabase, user: null, profile: null, memberships: [] as Membership[] };

  const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, avatar_path, created_at, updated_at").eq("id", user.id).maybeSingle(),
    supabase.from("school_memberships").select("id, school_id, user_id, role, status, approved_by, approved_at, created_at, updated_at").eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  if (profileError || membershipError) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  return { supabase, user, profile, memberships: (memberships ?? []) as Membership[] };
});

export async function requireUser() {
  const context = await getAuthContext();
  if (!context.user) redirect("/login");
  return context as typeof context & { user: NonNullable<typeof context.user> };
}

export const ACTIVE_SCHOOL_COOKIE = "school-active-tenant";
export type TenantSchool = {
  id: string; name: string; slug: string; is_active: boolean;
  created_at: string; updated_at: string;
  address: string | null; phone: string | null; email: string | null;
  principal_name: string | null; npsn: string | null; description: string | null;
  vision: string | null; mission: string | null; logo_path: string | null;
};

export const getTenantOptions = cache(async () => {
  const context = await requireUser();
  const memberships = context.memberships.filter((item) => item.user_id === context.user.id && item.status === "active" && item.role !== null && APP_ROLES.includes(item.role));
  if (!memberships.length) return { ...context, tenantOptions: [] };
  const { data, error } = await context.supabase.from("schools")
    .select("id, name, slug, is_active, created_at, updated_at, address, phone, email, principal_name, npsn, description, vision, mission, logo_path")
    .in("id", memberships.map((item) => item.school_id)).eq("is_active", true).order("id");
  if (error) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  const schools = (data ?? []) as TenantSchool[];
  const tenantOptions = schools.flatMap((school) => {
    const membership = memberships.find((item) => item.school_id === school.id);
    return school.is_active && membership ? [{ school, membership }] : [];
  });
  return { ...context, tenantOptions };
});

export const getActiveTenantContext = cache(async () => {
  const context = await getTenantOptions();
  const selected = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value;
  // Deterministic fallback is only used for absent/stale preferences; a valid selection wins.
  const tenant = context.tenantOptions.find((item) => item.school.id === selected) ?? context.tenantOptions[0];
  if (!tenant) {
    const suspended = context.memberships.some((item) => item.status === "suspended");
    redirect(suspended ? `/pending-approval?status=${ERROR_CODES.MEMBERSHIP_SUSPENDED}` : `/pending-approval?status=${ERROR_CODES.MEMBERSHIP_PENDING}`);
  }
  return { ...context, ...tenant, role: tenant.membership.role };
});

export const requireActiveMembership = getActiveTenantContext;

export async function getActiveMembership() {
  const context = await getAuthContext();
  if (!context.user) return null;
  const { tenantOptions } = await getTenantOptions();
  const selected = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value;
  return (tenantOptions.find((item) => item.school.id === selected) ?? tenantOptions[0])?.membership ?? null;
}

export async function requireCapability(capability: Capability) {
  const context = await getActiveTenantContext();
  if (!hasCapability(context, capability)) redirect("/dashboard?error=forbidden");
  return context;
}

// Compatibility adapters for existing consumers; all authorization uses the same context.
export async function requireSchoolRole(roles: readonly AppRole[]) {
  const context = await getActiveTenantContext();
  if (!context.role || !roles.includes(context.role)) redirect("/dashboard?error=forbidden");
  return context;
}
export async function requireSchoolAdmin() { return requireCapability("school.update"); }
export async function requireMasterDataAccess() { return requireCapability("academic.manage"); }
export async function requireMasterDataViewer() { return requireCapability("academic.read"); }
