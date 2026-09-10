"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function RegisterForm() {
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (!fullName.trim()) return setError("Nama lengkap wajib diisi.");
    if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");
    if (password !== confirmation) return setError("Konfirmasi kata sandi tidak sama.");
    setLoading(true);
    const { data, error: signUpError } = await createClient().auth.signUp({ email, password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` } });
    setLoading(false);
    if (signUpError) return setError("Pendaftaran belum berhasil. Periksa email dan coba lagi.");
    if (data.session) return setMessage("Akun berhasil dibuat. Anda dapat melanjutkan ke dashboard.");
    setMessage("Akun berhasil dibuat. Periksa email Anda untuk verifikasi sebelum masuk.");
  }
  return <form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-medium text-[#18312c]">Nama lengkap<input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label><label className="block text-sm font-medium text-[#18312c]">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label><label className="block text-sm font-medium text-[#18312c]">Kata sandi<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label><label className="block text-sm font-medium text-[#18312c]">Konfirmasi kata sandi<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label>{error && <p className="rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#b85e43]" role="alert">{error}</p>}{message && <p className="rounded-xl bg-[#edf6f0] px-4 py-3 text-sm text-[#20584c]" role="status">{message}</p>}<button type="submit" disabled={loading} className="w-full rounded-xl bg-[#20584c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2f7162] disabled:cursor-wait disabled:opacity-60">{loading ? "Membuat akun..." : "Daftar"}</button></form>;
}
