"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");
    if (password !== confirmation) return setError("Konfirmasi kata sandi tidak sama.");
    setLoading(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError("Tautan reset tidak valid atau sudah kedaluwarsa.");
    setMessage("Kata sandi berhasil diperbarui. Mengarahkan ke halaman masuk...");
    setTimeout(() => router.replace("/login?reset=success"), 900);
  }
  return <main className="min-h-screen bg-[#f6f8f5] px-6 py-10 sm:px-10"><div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center"><Link href="/" className="mb-10 flex items-center gap-3 text-sm font-semibold tracking-wide text-[#20584c]"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#20584c] text-lg text-white">K</span>KB DEVFANTA MELATI</Link><div className="rounded-[2rem] border border-[#dce7e1] bg-white p-7 shadow-[0_20px_60px_rgba(32,88,76,.08)] sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Pemulihan akses</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18312c]">Buat kata sandi baru</h1>{error && <p className="mt-5 rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#b85e43]" role="alert">{error}</p>}{message && <p className="mt-5 rounded-xl bg-[#edf6f0] px-4 py-3 text-sm text-[#20584c]" role="status">{message}</p>}<form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-medium text-[#18312c]">Kata sandi baru<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label><label className="block text-sm font-medium text-[#18312c]">Konfirmasi kata sandi<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label><button type="submit" disabled={loading} className="w-full rounded-xl bg-[#20584c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2f7162] disabled:cursor-wait disabled:opacity-60">{loading ? "Menyimpan..." : "Simpan kata sandi"}</button></form></div></div></main>;
}
