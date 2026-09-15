import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm, FormAlert } from "@/components/auth/auth-form";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ initialError = "", ready = false }: { initialError?: string; ready?: boolean }) {
  return <AuthCard eyebrow="Pemulihan akses" title="Buat kata sandi baru" description="Gunakan kata sandi yang kuat dan belum pernah dipakai untuk akun lain.">
    {ready ? <AuthForm mode="reset" action={resetPasswordAction} /> : <div className="mt-7 space-y-5"><FormAlert state={{ success: false, message: initialError }} /><Link href="/forgot-password" className="block text-sm font-semibold text-[#20584c] underline">Minta tautan pemulihan baru</Link></div>}
  </AuthCard>;
}
