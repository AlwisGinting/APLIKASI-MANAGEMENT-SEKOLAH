import Link from "next/link";
import { requireMasterDataViewer } from "@/lib/auth";

const items = [
  { href: "/dashboard/master/academic-years", title: "Tahun Ajaran", description: "Atur periode pendidikan dan status aktif sekolah." },
  { href: "/dashboard/master/semesters", title: "Semester", description: "Kelola semester dalam setiap tahun ajaran." },
  { href: "/dashboard/master/classrooms", title: "Rombel / Kelas", description: "Siapkan kelompok belajar tanpa memasukkan data siswa." },
];

export default async function MasterPage() {
  const { profile } = await requireMasterDataViewer();
  return <main className="min-h-screen bg-[#f6f8f5] px-6 py-10 sm:px-10"><div className="mx-auto max-w-5xl"><Link href="/dashboard" className="text-sm font-semibold text-[#2f7162]">← Kembali ke dashboard</Link><p className="mt-12 text-sm font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Data akademik</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#18312c]">Master Data</h1><p className="mt-3 max-w-2xl text-[#60736e]">Halo {profile?.full_name ?? "Pengguna"}, kelola struktur akademik sekolah dari satu tempat.</p><div className="mt-10 grid gap-4 md:grid-cols-3">{items.map((item) => <Link key={item.href} href={item.href} className="group rounded-[1.5rem] border border-[#dce7e1] bg-white p-6 shadow-[0_16px_45px_rgba(32,88,76,.05)] transition hover:-translate-y-1 hover:border-[#9bc9b5]"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#edf6f0] text-lg font-semibold text-[#20584c]">{item.title.charAt(0)}</span><span className="text-xl text-[#9bb4aa] transition group-hover:translate-x-1">→</span></div><h2 className="mt-7 text-lg font-semibold text-[#18312c]">{item.title}</h2><p className="mt-2 text-sm leading-6 text-[#60736e]">{item.description}</p></Link>)}</div></div></main>;
}
