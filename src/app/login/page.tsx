import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const params = await searchParams;
  return <AuthCard eyebrow="Selamat datang" title="Masuk ke sistem" description="Kelola administrasi sekolah dengan lebih mudah." footer={<>Belum punya akun? <Link href="/register" className="font-semibold text-[#20584c] underline">Daftar sekarang</Link></>}>
    <LoginForm initialError={params.error === "verification" ? "Verifikasi email belum selesai atau tautannya sudah tidak valid." : ""} initialMessage={params.reset === "success" ? "Kata sandi berhasil diperbarui. Silakan masuk kembali." : ""} />
  </AuthCard>;
}
