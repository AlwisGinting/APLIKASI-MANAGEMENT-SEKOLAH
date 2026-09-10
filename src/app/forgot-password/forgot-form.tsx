"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (resetError) return setError("Permintaan belum dapat diproses. Coba lagi beberapa saat.");
    setMessage("Jika email tersebut terdaftar, tautan reset akan segera dikirim.");
  }
  return <form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-medium text-[#18312c]">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label>{error && <p className="rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#b85e43]" role="alert">{error}</p>}{message && <p className="rounded-xl bg-[#edf6f0] px-4 py-3 text-sm text-[#20584c]" role="status">{message}</p>}<button type="submit" disabled={loading} className="w-full rounded-xl bg-[#20584c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2f7162] disabled:cursor-wait disabled:opacity-60">{loading ? "Mengirim..." : "Kirim tautan reset"}</button></form>;
}
