import Link from "next/link";
import { GoogleLogin } from "@/components/auth/google-login";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const params = await searchParams;
  return <AuthCard eyebrow="Selamat datang" title="Masuk ke sistem" description="Kelola administrasi sekolah dengan lebih mudah." footer={<>Belum punya akun? <Link href="/register" className="font-semibold text-[#20584c] underline">Daftar sekarang</Link></>}>
    <GoogleLogin />
    <p className="my-5 text-center text-sm">Atau masuk dengan email dan kata sandi</p>
    <LoginForm initialError={params.error === "oauth" ? "Masuk dengan Google dibatalkan atau belum berhasil. Silakan coba kembali." : params.error === "verification" ? "Sesi masuk belum dapat diselesaikan. Silakan coba kembali." : ""} initialMessage={params.reset === "success" ? "Kata sandi berhasil diperbarui. Silakan masuk kembali." : ""} />
    <div className="mt-5 text-center"><Link href="/forgot-password" className="text-sm font-semibold text-[#20584c] underline">Lupa kata sandi?</Link></div>
  </AuthCard>;
}
