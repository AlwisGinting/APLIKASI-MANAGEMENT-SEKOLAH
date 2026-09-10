"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function LoginForm({ initialError = "", initialMessage = "" }: { initialError?: string; initialMessage?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message.toLowerCase().includes("email not confirmed") ? "Email Anda belum diverifikasi. Periksa kotak masuk untuk tautan verifikasi." : "Email atau kata sandi tidak sesuai.");
      return;
    }
    router.replace("/dashboard"); router.refresh();
  }
  return <form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-medium text-[#18312c]">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none transition focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label><label className="block text-sm font-medium text-[#18312c]">Kata sandi<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3 outline-none transition focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]" /></label>{error && <p className="rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#b85e43]" role="alert">{error}</p>}{message && <p className="rounded-xl bg-[#edf6f0] px-4 py-3 text-sm text-[#20584c]" role="status">{message}</p>}<div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-semibold text-[#2f7162] hover:text-[#e98a6a]">Lupa kata sandi?</Link></div><button type="submit" disabled={loading} className="w-full rounded-xl bg-[#20584c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2f7162] disabled:cursor-wait disabled:opacity-60">{loading ? "Memeriksa..." : "Masuk"}</button></form>;
}
