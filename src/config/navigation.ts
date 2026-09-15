import { hasCapability, type Capability } from "@/lib/capabilities";
import { APP_CONFIG, type AppRole } from "./app";
const R = APP_CONFIG.routes;
type Item = { href: string; label: string; capability?: Capability };
const groups: { label: string; items: Item[] }[] = [
  { label: "Dashboard", items: [{ href: R.dashboard, label: "Dashboard" }] },
  { label: "Akademik", items: [{ href: R.master, label: "Master Data", capability: "academic.read" }] },
  { label: "Administrasi", items: [{ href: R.users, label: "Pengguna", capability: "users.read" }, { href: R.feedback, label: "Feedback" }] },
  { label: "Akun", items: [{ href: R.profile, label: "Profil" }, { href: R.settings, label: "Pengaturan" }, { href: R.activity, label: "Aktivitas" }, { href: R.notifications, label: "Pemberitahuan" }] },
  { label: "Bantuan", items: [{ href: R.help, label: "Pusat Bantuan" }, { href: R.about, label: "Tentang" }] },
];
export function navigationForRole(role: AppRole | null) {
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => hasCapability({ membership: { role, status: "active" } }, item.capability ?? "dashboard.read")) })).filter((group) => group.items.length);
}
