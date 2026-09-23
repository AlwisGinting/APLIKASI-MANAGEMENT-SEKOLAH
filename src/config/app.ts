export const APP_CONFIG = {
  name: "SIM KB DEVFANTA MELATI",
  defaultSchoolSlug: "kb-devfanta-melati",
  routes: {
    login: "/login",
    dashboard: "/dashboard",
    pendingApproval: "/pending-approval",
    feedback: "/dashboard/feedback",
    master: "/dashboard/master",
    users: "/dashboard/users",
    profile: "/dashboard/profile",
    settings: "/dashboard/settings",
    security: "/dashboard/settings/security",
    school: "/dashboard/settings/school",
    appearance: "/dashboard/settings/appearance",
    help: "/dashboard/help",
    about: "/dashboard/about",
    activity: "/dashboard/activity",
    notifications: "/dashboard/notifications",
    system: "/dashboard/system",
    privacy: "/privacy",
    terms: "/terms",
  },
  password: { minimumLength: 8 },
  feedback: {
    titleMaxLength: 200,
    messageMaxLength: 5000,
    currentPathMaxLength: 1000,
  },
} as const;

export const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password"] as const;
export const AUTH_ROLES = ["super_admin", "kepala_sekolah", "operator", "guru", "orang_tua"] as const;
export const MEMBERSHIP_STATUSES = ["pending", "active", "rejected", "suspended"] as const;
export type AppRole = (typeof AUTH_ROLES)[number];
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
