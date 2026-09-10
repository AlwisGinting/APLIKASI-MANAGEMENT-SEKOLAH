import Link from "next/link";
import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ error?: string; reset?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[#f6f8f5] px-6 py-10 sm:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <Link href="/" className="mb-10 flex items-center gap-3 text-sm font-semibold tracking-wide text-[#20584c]"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#20584c] text-lg text-white">K</span>KB DEVFANTA MELATI</Link>
        <div className="rounded-[2rem] border border-[#dce7e1] bg-white p-7 shadow-[0_20px_60px_rgba(32,88,76,.08)] sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Selamat datang</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18312c]">Masuk ke sistem</h1>
          <p className="mt-3 text-sm leading-6 text-[#60736e]">Kelola administrasi sekolah dengan lebih mudah.</p>
          <LoginForm initialError={params.error === "verification" ? "Verifikasi email belum selesai atau tautannya sudah tidak valid." : ""} initialMessage={params.reset === "success" ? "Kata sandi berhasil diperbarui. Silakan masuk kembali." : ""} />
          <p className="mt-7 text-center text-sm text-[#60736e]">Belum punya akun? <Link href="/register" className="font-semibold text-[#2f7162]">Daftar sekarang</Link></p>
        </div>
      </div>
    </main>
  );
}
