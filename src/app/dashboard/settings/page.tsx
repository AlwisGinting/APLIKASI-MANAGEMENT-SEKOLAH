import { requireCapability } from "@/lib/auth";
import { canViewSchool } from "@/lib/shell";
import { APP_CONFIG } from "@/config/app";
import { Page, QuickLink } from "@/components/dashboard/ui";
const R = APP_CONFIG.routes;
export default async function SettingsPage() {
  const { membership } = await requireCapability("profile.read");
  return <Page title="Pengaturan" description="Sesuaikan akun, tampilan, dan informasi sekolah dari satu tempat."><div className="grid gap-4 sm:grid-cols-2"><QuickLink href={R.profile} title="Profil" description="Nama, telepon, dan informasi membership Anda." /><QuickLink href={R.appearance} title="Tampilan & preferensi" description="Tema sistem, terang atau gelap; mode ringkas dan bahasa." /><QuickLink href={R.security} title="Keamanan" description="Ubah kata sandi dan kelola logout sesi akun." />{canViewSchool(membership.role) && <QuickLink href={R.school} title="Profil sekolah" description="Informasi organisasi dan kontak sekolah aktif." />}<QuickLink href={R.notifications} title="Pemberitahuan" description="Status akun dan pembaruan feedback Anda." /><QuickLink href={R.help} title="Bantuan" description="Panduan akun dan kontak administrator sekolah." /><QuickLink href={R.about} title="Tentang aplikasi" description="Informasi sekolah, versi, dan kebijakan aplikasi." /></div></Page>;
}
