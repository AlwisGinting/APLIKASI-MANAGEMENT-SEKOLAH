import { cookies } from "next/headers";
import { requireCapability } from "@/lib/auth";
import { Page, Card } from "@/components/dashboard/ui";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { saveAppearance } from "../actions";
export default async function AppearancePage() {
  await requireCapability("profile.read");
  const store = await cookies();
  const value = store.get("school-ui-theme")?.value;
  const theme = value === "dark" || value === "light" ? value : "system";
  return <Page title="Tampilan & preferensi" description="Pilihan ini berlaku pada dashboard di browser yang sedang Anda gunakan."><Card title="Tampilan"><SettingsForm action={saveAppearance} fields={[{ name: "theme", label: "Tema", type: "select", value: theme, options: [{ value: "system", label: "Ikuti sistem" }, { value: "light", label: "Terang" }, { value: "dark", label: "Gelap" }] }, { name: "compact", label: "Gunakan jarak tampilan lebih ringkas", type: "checkbox", value: store.get("school-ui-compact")?.value }]} /></Card><Card title="Bahasa"><p>Bahasa Indonesia</p><p className="muted mt-2 text-sm">Bahasa lain belum tersedia. Tanggal ditampilkan dalam zona waktu WIB.</p></Card></Page>;
}
