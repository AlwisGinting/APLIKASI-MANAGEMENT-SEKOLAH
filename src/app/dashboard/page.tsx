import { getAcademicContext } from "@/lib/academic";
import { hasCapability } from "@/lib/capabilities";
import { APP_CONFIG } from "@/config/app";
import { Page, Card, Avatar, Info, TenantContext, QuickLink } from "@/components/dashboard/ui";
const R = APP_CONFIG.routes;
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const context = await getAcademicContext();
  const params = await searchParams;
  const canReadAcademic = hasCapability(context, "academic.read");
  const academicYear = canReadAcademic ? context.academicYear?.name ?? "Belum ada tahun ajaran aktif" : "Tidak tersedia untuk role Anda";
  const semester = canReadAcademic ? context.semester?.name ?? "Belum ada semester aktif" : "Tidak tersedia untuk role Anda";
  return <Page title="Dashboard" description="Ringkasan akun dan sekolah aktif Anda.">{params.error && <p role="alert" className="notice rounded-xl border p-4">Anda tidak memiliki akses ke halaman atau tindakan tersebut.</p>}<Card><div className="mb-6 flex items-center gap-4"><Avatar name={context.profile?.full_name ?? "Pengguna"} /><div><h2 className="text-xl font-semibold">Selamat datang, {context.profile?.full_name ?? "Pengguna"}.</h2><p className="muted mt-1 text-sm">Ruang kerja {context.school.name}</p></div></div><TenantContext school={context.school.name} role={context.membership.role} status={context.membership.status} /></Card><Card title="Periode akademik"><dl className="grid gap-5 sm:grid-cols-2"><Info label="Tahun ajaran aktif" value={academicYear} /><Info label="Semester aktif" value={semester} /></dl></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><QuickLink href={R.profile} title="Profil" description="Kelola nama dan informasi akun." /><QuickLink href={R.settings} title="Pengaturan" description="Sesuaikan tampilan dan keamanan." />{canReadAcademic && <QuickLink href={R.master} title="Master Data" description="Tahun ajaran, semester, dan kelas." />}<QuickLink href={R.feedback} title="Feedback" description="Lihat masukan yang telah dikirim." /><QuickLink href={R.help} title="Bantuan" description="Panduan penggunaan singkat." /></div></Page>;
}
