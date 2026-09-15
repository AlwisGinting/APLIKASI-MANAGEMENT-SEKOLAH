"use client";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { APP_CONFIG } from "@/config/app";
import { submitFeedback } from "./actions";
const initialState = { success: false, error: "" };
export function FeedbackButton() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [revision, setRevision] = useState(0);
  return <>
    <button ref={trigger} type="button" onClick={() => { setRevision((value) => value + 1); dialog.current?.showModal(); }} className="fixed bottom-4 right-4 z-40 rounded-full bg-[#20584c] px-4 py-3 text-sm font-semibold text-white shadow-lg sm:bottom-6 sm:right-6">✎ Feedback</button>
    <dialog ref={dialog} aria-labelledby="feedback-title" onClose={() => trigger.current?.focus()} className="surface fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border p-6 text-inherit shadow-2xl backdrop:bg-black/40 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 id="feedback-title" className="text-2xl font-semibold">Kirim feedback</h2><button type="button" aria-label="Tutup feedback" onClick={() => dialog.current?.close()} className="min-h-11 min-w-11 rounded-lg text-2xl">×</button></div>
      <FeedbackForm key={revision} path={pathname} close={() => dialog.current?.close()} />
    </dialog>
  </>;
}
function FeedbackForm({ path, close }: { path: string; close: () => void }) {
  const [state, action, pending] = useActionState(submitFeedback, initialState);
  const lock = useRef(false);
  useEffect(() => { lock.current = false; }, [state]);
  return state.success ? <div role="status" aria-live="polite"><p>Feedback berhasil dikirim. Terima kasih atas masukan Anda.</p><button type="button" className="primary-button mt-5" onClick={close}>Tutup</button></div> : <form action={action} onSubmit={(event) => { if (lock.current || pending) event.preventDefault(); else lock.current = true; }} className="space-y-4" aria-busy={pending}>
    <input type="hidden" name="current_path" value={path} />
    <fieldset disabled={pending} className="space-y-4"><legend className="sr-only">Isi feedback</legend>
      <label className="block text-sm font-medium">Jenis<select name="type" defaultValue="suggestion" className="field mt-2"><option value="suggestion">Saran</option><option value="bug">Bug / Error</option><option value="complaint">Keluhan</option><option value="other">Lainnya</option></select></label>
      <label className="block text-sm font-medium">Judul<input name="title" required maxLength={APP_CONFIG.feedback.titleMaxLength} className="field mt-2" /></label>
      <label className="block text-sm font-medium">Pesan<textarea name="message" required maxLength={APP_CONFIG.feedback.messageMaxLength} rows={5} className="field mt-2" /></label>
      <div aria-live="polite">{state.error && <p role="alert" className="notice rounded-xl border p-3 text-sm">{state.error}</p>}</div>
      <button type="submit" disabled={pending} className="primary-button w-full">{pending ? "Mengirim..." : "Kirim feedback"}</button>
    </fieldset>
  </form>;
}
