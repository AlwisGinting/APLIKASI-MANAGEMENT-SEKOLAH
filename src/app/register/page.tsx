import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AuthCard eyebrow="Akun baru" title="Daftar akun" description="Setelah email diverifikasi, administrator sekolah akan meninjau akses Anda." footer={<>Sudah punya akun? <Link href="/login" className="font-semibold text-[#20584c] underline">Masuk</Link></>}><RegisterForm /></AuthCard>;
}
