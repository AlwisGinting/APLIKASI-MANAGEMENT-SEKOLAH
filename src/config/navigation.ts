import { hasCapability, type Capability } from "@/lib/capabilities";
import { APP_CONFIG, type AppRole } from "./app";
const R = APP_CONFIG.routes;
type Item = { href: string; label: string; capability?: Capability; account?: boolean };
const groups: { label: string; items: Item[] }[] = [
  { label: "Dashboard", items: [{ href: R.dashboard, label: "Dashboard" }] },
  { label: "Akademik", items: [{ href: R.master, label: "Master Data", capability: "academic.read" }] },
  { label: "Administrasi", items: [{ href: R.users, label: "Pengguna", capability: "users.read" }, { href: R.feedback, label: "Feedback", capability: "feedback.read_own" }] },
  { label: "Akun", items: [{ href: R.profile, label: "Profil", capability: "profile.read", account: true }, { href: R.settings, label: "Pengaturan", capability: "profile.read", account: true }, { href: R.security, label: "Keamanan / Atur Kata Sandi", capability: "profile.read", account: true }, { href: R.activity, label: "Aktivitas", capability: "activity.read" }, { href: R.notifications, label: "Pemberitahuan", capability: "notifications.read" }, { href: R.system, label: "Sistem", capability: "system.read" }] },
  { label: "Bantuan", items: [{ href: R.help, label: "Pusat Bantuan", account: true }, { href: R.about, label: "Tentang" }] },
];
export function navigationForRole(role: AppRole | null) {
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => hasCapability({ membership: { role, status: "active" } }, item.capability ?? "dashboard.read")) })).filter((group) => group.items.length);
}
// Account, desktop and mobile links share labels, routes and capabilities.
export function accountNavigationForRole(role: AppRole | null) {
  return navigationForRole(role).flatMap(group => group.items.filter(item => item.account));
}
export function activeNavigationHref(pathname: string, items: readonly Item[]) {
  return items.filter(item => pathname === item.href || (item.href !== R.dashboard && pathname.startsWith(item.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
