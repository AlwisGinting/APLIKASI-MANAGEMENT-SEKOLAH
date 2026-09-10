import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f8f5]">
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[#dcefe5] blur-3xl" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-wide text-[#20584c]"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#20584c] text-lg text-white">K</span><span>KB DEVFANTA MELATI</span></Link>
          <Link href="/login" className="text-sm font-semibold text-[#20584c] hover:text-[#e98a6a]">Masuk</Link>
        </header>
        <section className="relative grid gap-12 py-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-24">
          <div><p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-[#e98a6a]">Ruang kerja sekolah</p><h1 className="max-w-2xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-[#18312c] sm:text-7xl">Administrasi sekolah, lebih ringan setiap hari.</h1><p className="mt-7 max-w-lg text-lg leading-8 text-[#60736e]">SIM KB DEVFANTA MELATI membantu tim sekolah menjaga pekerjaan administrasi tetap rapi, terarah, dan mudah diakses.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/login" className="rounded-full bg-[#20584c] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2f7162]">Masuk ke sistem</Link><Link href="/register" className="rounded-full border border-[#c7d8d0] bg-white/60 px-6 py-3 text-center text-sm font-semibold text-[#20584c] transition hover:border-[#2f7162]">Buat akun</Link></div></div>
          <div className="relative mx-auto w-full max-w-sm"><div className="rounded-[2rem] border border-white bg-white/75 p-5 shadow-[0_24px_70px_rgba(32,88,76,.14)] backdrop-blur"><div className="flex items-center justify-between border-b border-[#e6eee9] pb-5"><span className="text-sm font-semibold text-[#18312c]">Ringkasan hari ini</span><span className="h-2.5 w-2.5 rounded-full bg-[#e98a6a]" /></div><div className="grid grid-cols-2 gap-3 py-5"><div className="rounded-2xl bg-[#edf6f0] p-4"><p className="text-xs text-[#60736e]">Kehadiran</p><p className="mt-2 text-2xl font-semibold text-[#20584c]">100%</p></div><div className="rounded-2xl bg-[#fff2ec] p-4"><p className="text-xs text-[#60736e]">Agenda</p><p className="mt-2 text-2xl font-semibold text-[#b85e43]">03</p></div></div><div className="space-y-3"><div className="h-3 w-4/5 rounded-full bg-[#dcebe2]" /><div className="h-3 w-3/5 rounded-full bg-[#e9f1ed]" /><div className="h-3 w-2/3 rounded-full bg-[#e9f1ed]" /></div></div><div className="absolute -bottom-5 -left-5 rounded-2xl bg-[#e98a6a] px-4 py-3 text-sm font-semibold text-white shadow-lg">Tumbuh bersama</div></div>
        </section>
        <footer className="border-t border-[#dce7e1] py-5 text-xs text-[#60736e]">Platform administrasi digital untuk KB DEVFANTA MELATI</footer>
      </div>
    </main>
  );
}
