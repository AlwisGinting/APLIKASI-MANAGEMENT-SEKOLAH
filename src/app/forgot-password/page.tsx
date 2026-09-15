import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "./forgot-form";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AuthCard eyebrow="Pemulihan akses" title="Lupa kata sandi?" description="Masukkan email untuk meminta tautan pemulihan akun." footer={<><Link href="/login" className="font-semibold text-[#20584c] underline">Kembali ke halaman masuk</Link></>}><ForgotPasswordForm /></AuthCard>;
}
