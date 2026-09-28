import type { AppRole } from "@/config/app";
const all = ["super_admin", "kepala_sekolah", "operator", "guru", "orang_tua"] as const;
const admins = ["super_admin", "kepala_sekolah"] as const;
const operators = [...admins, "operator"] as const;
// Applied 001-007 plus draft 008/009. Basic access is an explicit allowlist, not a role.
// Unknown roles/capabilities always fail closed; tenant/school checks live in auth.ts.
export const capabilityRoles = {
  "dashboard.read": all,
  "profile.read": all,
  "profile.update_self": all,
  "school.read": all,
  "school.update": admins,
  "users.read": admins,
  "users.manage": ["super_admin"],
  "users.manage_super_admin": ["super_admin"],
  "academic.read": [...operators, "guru"],
  "academic.manage": operators,
  "academic.delete": admins,
  "academic.custom_semester_name": ["super_admin"],
  "feedback.create": all,
  "feedback.read_own": all,
  "feedback.manage": admins,
  "feedback.delete": ["super_admin"],
  "activity.read": all,
  "audit.read": admins,
  "system.read": ["super_admin"],
  "notifications.read": all,
} as const satisfies Record<string, readonly AppRole[]>;
export const basicCapabilities = ["dashboard.read", "profile.read", "profile.update_self", "school.read"] as const;
export type Capability = keyof typeof capabilityRoles;
export function hasCapability(context: { membership: { role: AppRole | null; status: string } }, capability: Capability): boolean {
  const roles: readonly string[] | undefined = Object.hasOwn(capabilityRoles, capability) ? capabilityRoles[capability] : undefined;
  if (context.membership.status !== "active" || !roles) return false;
  if (context.membership.role === null) return (basicCapabilities as readonly string[]).includes(capability);
  return roles.includes(context.membership.role);
}
