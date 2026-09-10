"use client";

import { usePathname } from "next/navigation";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitFeedback } from "./actions";

const initialState = { success: false, error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-xl bg-[#20584c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2f7162] disabled:cursor-wait disabled:opacity-60">{pending ? "Mengirim..." : "Kirim feedback"}</button>;
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [state, formAction] = useActionState(submitFeedback, initialState);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#20584c] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(32,88,76,.22)] transition hover:bg-[#2f7162] focus:outline-none focus:ring-4 focus:ring-[#c8e2d7] sm:bottom-7 sm:right-7"><span aria-hidden="true">✎</span> Feedback</button>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#18312c]/30 p-4 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Ruang dengar</p><h2 id="feedback-title" className="mt-2 text-2xl font-semibold text-[#18312c]">Kirim feedback</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Tutup feedback" className="text-2xl leading-none text-[#60736e]">×</button></div>{state.success ? <div className="mt-6 rounded-xl bg-[#edf6f0] p-5 text-sm leading-6 text-[#20584c]" role="status"><p className="font-semibold">Feedback berhasil dikirim.</p><p className="mt-1">Terima kasih, masukan Anda akan ditinjau oleh tim sekolah.</p><button type="button" onClick={() => setOpen(false)} className="mt-4 rounded-lg border border-[#9bc9b5] px-4 py-2 font-semibold">Tutup</button></div> : <form action={formAction} className="mt-6 space-y-4"><input type="hidden" name="current_path" value={pathname} /><label className="block text-sm font-medium text-[#18312c]">Jenis<select name="type" defaultValue="suggestion" className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3"><option value="suggestion">Saran</option><option value="bug">Bug / Error</option><option value="complaint">Keluhan</option><option value="other">Lainnya</option></select></label><label className="block text-sm font-medium text-[#18312c]">Judul<input name="title" required maxLength={200} className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3" /></label><label className="block text-sm font-medium text-[#18312c]">Pesan<textarea name="message" required maxLength={5000} rows={5} className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3" /></label>{state.error && <p className="rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#b85e43]" role="alert">{state.error}</p>}<SubmitButton /></form>}</section></div>}
  </>;
}
