import type { AppRole } from "@/config/app";
const all = ["super_admin", "kepala_sekolah", "operator", "guru", "orang_tua"] as const;
const admins = ["super_admin", "kepala_sekolah"] as const;
const operators = [...admins, "operator"] as const;
// Mirrors RLS 002–006 and the reviewed audit design in pending 007. Unknown roles/capabilities always fail closed.
export const capabilityRoles = {
  "dashboard.read": all,
  "profile.read": all,
  "profile.update_self": all,
  "school.read": all,
  "school.update": admins,
  "users.read": admins,
  "users.manage": admins,
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
export type Capability = keyof typeof capabilityRoles;
export function hasCapability(context: { membership: { role: AppRole | null; status: string } }, capability: Capability): boolean {
  const roles: readonly string[] | undefined = Object.hasOwn(capabilityRoles, capability) ? capabilityRoles[capability] : undefined;
  return context.membership.status === "active" && context.membership.role !== null && !!roles?.includes(context.membership.role);
}
