"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { settingsInitial, type SettingsState } from "@/lib/settings";
export type Field = { name: string; label: string; type?: "text" | "email" | "tel" | "password" | "textarea" | "select" | "checkbox"; value?: string; required?: boolean; maxLength?: number; minLength?: number; autoComplete?: string; options?: { value: string; label: string }[] };
function Password({ field, described, invalid }: { field: Field; described?: string; invalid: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><input className="field pr-24" name={field.name} id={field.name} type={visible ? "text" : "password"} required={field.required} minLength={field.minLength} autoComplete={field.autoComplete} aria-invalid={invalid} aria-describedby={described} /><button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible} aria-controls={field.name} aria-label={`${visible ? "Sembunyikan" : "Tampilkan"} ${field.label.toLowerCase()}`} className="absolute right-2 top-3 rounded px-2 py-1 text-sm">{visible ? "Sembunyi" : "Lihat"}</button></div>;
}
export function SettingsForm({ action, fields, label = "Simpan perubahan" }: { action: (previous: SettingsState, data: FormData) => Promise<SettingsState>; fields: Field[]; label?: string }) {
  const [state, formAction, pending] = useActionState(action, settingsInitial);
  const ref = useRef<HTMLFormElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    lock.current = false;
    if (state === settingsInitial) return;
    ref.current?.querySelectorAll<HTMLInputElement>('input[autocomplete="current-password"], input[autocomplete="new-password"]').forEach((input) => { input.value = ""; });
    if (!state.success && state.fieldErrors) ref.current?.querySelector<HTMLInputElement>(`[name="${Object.keys(state.fieldErrors)[0]}"]`)?.focus();
  }, [state]);
  return <form ref={ref} action={formAction} aria-busy={pending} className="space-y-5" onSubmit={(event) => { if (pending || lock.current) event.preventDefault(); else lock.current = true; }}>
    <div aria-live="polite" aria-atomic="true">{state.message && <p role={state.success ? "status" : "alert"} className="notice rounded-xl border p-4 text-sm">{state.message}</p>}</div>
    <fieldset disabled={pending} className="min-w-0 space-y-5"><legend className="sr-only">{label}</legend>{fields.map((field) => {
      const error = state.fieldErrors?.[field.name];
      const props = { name: field.name, id: field.name, required: field.required, "aria-invalid": Boolean(error), "aria-describedby": error ? `${field.name}-error` : undefined };
      return <div key={field.name}><label htmlFor={field.name} className="mb-2 block text-sm font-medium">{field.label}</label>{field.type === "password" ? <Password field={field} described={props["aria-describedby"]} invalid={Boolean(error)} /> : field.type === "textarea" ? <textarea {...props} className="field" defaultValue={field.value} maxLength={field.maxLength} rows={4} /> : field.type === "select" ? <select {...props} className="field" defaultValue={field.value}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "checkbox" ? <input {...props} type="checkbox" defaultChecked={field.value === "true"} className="h-5 w-5 accent-[#20584c]" /> : <input {...props} className="field" type={field.type ?? "text"} defaultValue={field.value} maxLength={field.maxLength} autoComplete={field.autoComplete} />}{error && <p id={`${field.name}-error`} className="mt-2 text-sm">{error}</p>}</div>;
    })}<button type="submit" disabled={pending} className="primary-button">{pending ? "Memproses..." : label}</button></fieldset>
  </form>;
}
