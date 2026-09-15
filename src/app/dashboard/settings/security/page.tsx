import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { APP_CONFIG } from "@/config/app";
import { Page, Card, Info } from "@/components/dashboard/ui";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { changePassword, logoutAll, logoutSession } from "../actions";
export default async function SecurityPage() {
  const { user } = await requireCapability("profile.read");
  return <Page title="Keamanan akun" description="Jangan bagikan kata sandi atau tautan pemulihan kepada orang lain.">
    <Card title="Identitas akun"><dl className="grid gap-5 sm:grid-cols-2"><Info label="Email" value={user.email} /><Info label="Verifikasi email" value={user.email_confirmed_at ? "Sudah diverifikasi" : "Belum diverifikasi"} /></dl></Card>
    <Card title="Ubah kata sandi"><SettingsForm action={changePassword} label="Perbarui kata sandi" fields={[{ name: "current_password", label: "Kata sandi saat ini", type: "password", required: true, autoComplete: "current-password" }, { name: "password", label: "Kata sandi baru (minimal 8 karakter)", type: "password", required: true, minLength: 8, autoComplete: "new-password" }, { name: "confirmation", label: "Konfirmasi kata sandi baru", type: "password", required: true, minLength: 8, autoComplete: "new-password" }]} /><Link href="/forgot-password" className="mt-5 inline-block text-sm underline">Lupa kata sandi saat ini?</Link></Card>
    <Card title="Sesi akun"><form action={logoutSession}><button type="submit" className="primary-button">Logout perangkat ini</button></form><p className="muted my-5 text-sm leading-6">Jika akun digunakan pada perangkat bersama atau perangkat hilang, keluar dari semua sesi. Sesi di perangkat lain mungkin masih dapat mengakses layanan sampai masa aksesnya berakhir.</p><SettingsForm action={logoutAll} label="Logout semua sesi" fields={[{ name: "confirm", label: "Saya ingin keluar dari semua sesi, termasuk perangkat ini", type: "checkbox", required: true }]} /><Link href={APP_CONFIG.routes.activity} className="mt-5 inline-block text-sm underline">Lihat aktivitas akun</Link></Card>
  </Page>;
}
