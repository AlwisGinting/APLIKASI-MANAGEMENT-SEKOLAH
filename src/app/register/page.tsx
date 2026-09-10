import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return <main className="min-h-screen bg-[#f6f8f5] px-6 py-10 sm:px-10"><div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center"><Link href="/" className="mb-10 flex items-center gap-3 text-sm font-semibold tracking-wide text-[#20584c]"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#20584c] text-lg text-white">K</span>KB DEVFANTA MELATI</Link><div className="rounded-[2rem] border border-[#dce7e1] bg-white p-7 shadow-[0_20px_60px_rgba(32,88,76,.08)] sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Akun baru</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18312c]">Daftar akun</h1><p className="mt-3 text-sm leading-6 text-[#60736e]">Setelah email diverifikasi, admin sekolah akan meninjau dan menyetujui akses Anda.</p><RegisterForm /><p className="mt-7 text-center text-sm text-[#60736e]">Sudah punya akun? <Link href="/login" className="font-semibold text-[#2f7162]">Masuk</Link></p></div></div></main>;
}
