import { requireCapability } from "@/lib/auth";
import { dateLabel } from "@/lib/shell";
import { Page, Card, Avatar, Info, TenantContext } from "@/components/dashboard/ui";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { saveProfile } from "../settings/actions";
export default async function ProfilePage() {
  const { user, profile, membership, school } = await requireCapability("profile.read");
  return <Page title="Profil saya" description="Kelola informasi pribadi Anda. Email, role, dan akses sekolah dikelola melalui proses akun resmi.">
    <Card><div className="mb-6 flex items-center gap-4"><Avatar name={profile?.full_name ?? "Pengguna"} /><div><h2 className="text-lg font-semibold">{profile?.full_name ?? "Pengguna"}</h2><p className="muted break-all text-sm">{user.email}</p></div></div><TenantContext school={school.name} role={membership.role} status={membership.status} /><dl className="mt-6 grid gap-5 sm:grid-cols-2"><Info label="Akun dibuat" value={dateLabel(user.created_at)} /><Info label="Profil terakhir diperbarui" value={dateLabel(profile?.updated_at)} /></dl></Card>
    <Card title="Edit profil"><SettingsForm action={saveProfile} fields={[{ name: "full_name", label: "Nama lengkap", value: profile?.full_name ?? "", required: true, maxLength: 150, autoComplete: "name" }, { name: "phone", label: "Nomor telepon (opsional)", value: profile?.phone ?? "", type: "tel", maxLength: 40, autoComplete: "tel" }]} /><p className="muted mt-5 text-sm">Foto profil belum tersedia. Inisial nama digunakan sebagai avatar.</p></Card>
  </Page>;
}
