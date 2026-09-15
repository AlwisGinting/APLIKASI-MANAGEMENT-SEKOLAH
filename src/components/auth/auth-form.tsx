"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initialAuthState, validateAuthForm, type AuthField, type AuthFormState, type AuthMode } from "@/lib/auth-form";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-[#9aafa4] px-4 py-3 text-base text-[#18312c] outline-none focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5] disabled:opacity-60";
const linkClass = "font-semibold text-[#20584c] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4";

function FieldError({ name, error }: { name: string; error?: string }) {
  return error ? <p id={`${name}-error`} className="mt-2 text-sm text-[#a3452d]">{error}</p> : null;
}

function PasswordField({ name, label, error, newPassword }: { name: "password" | "confirmation"; label: string; error?: string; newPassword: boolean }) {
  const [visible, setVisible] = useState(false);
  const [longEnough, setLongEnough] = useState(false);
  const hint = newPassword && name === "password";
  return <div>
    <label htmlFor={name} className="text-sm font-medium text-[#18312c]">{label}</label>
    <div className="relative">
      <input id={name} name={name} type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} required minLength={newPassword ? 8 : undefined} className={`${inputClass} pr-24`} aria-invalid={Boolean(error)} aria-describedby={[hint ? `${name}-hint` : "", error ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined} onInput={(event) => setLongEnough(event.currentTarget.value.length >= 8)} />
      <button type="button" aria-controls={name} aria-pressed={visible} aria-label={`${visible ? "Sembunyikan" : "Tampilkan"} ${label.toLowerCase()}`} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-1 mt-2 min-w-20 rounded-lg px-2 text-xs font-semibold text-[#20584c] focus-visible:outline-2 focus-visible:outline-offset-2">{visible ? "Sembunyi" : "Lihat"}</button>
    </div>
    {hint && <p id={`${name}-hint`} className="mt-2 text-sm text-[#526b61]">{longEnough ? "✓ Minimal 8 karakter terpenuhi." : "Gunakan minimal 8 karakter."}</p>}
    <FieldError name={name} error={error} />
  </div>;
}

export function FormAlert({ state }: { state: AuthFormState }) {
  return <div aria-live={state.success ? "polite" : "assertive"} aria-atomic="true">
    {state.message && <p role={state.success ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm leading-6 ${state.success ? "bg-[#edf6f0] text-[#20584c]" : "bg-[#fff1ed] text-[#a3452d]"}`}>{state.message}</p>}
  </div>;
}

export function AuthForm({ mode, action, initialState = initialAuthState }: { mode: AuthMode; action: (previous: AuthFormState, data: FormData) => Promise<AuthFormState>; initialState?: AuthFormState }) {
  const path = { register: "/register", login: "/login", forgot: "/forgot-password", reset: "/reset-password" }[mode];
  const [state, formAction, pending] = useActionState(action, initialState, path);
  const [localError, setLocalError] = useState<AuthFormState | null>(null);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const shown = localError ?? state;
  const finished = state.success && mode !== "login";
  const newPassword = mode === "register" || mode === "reset";

  useEffect(() => {
    lock.current = false;
    if (state === initialState) return;
    // Never retain passwords in action results or React state.
    form.current?.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"], input[autocomplete="current-password"]').forEach((input) => { input.value = ""; });
    if (!state.success || mode !== "reset") return;
    const timer = setTimeout(() => { router.replace("/login?reset=success"); router.refresh(); }, 1600);
    return () => clearTimeout(timer);
  }, [state, initialState, mode, router]);

  const buttonLabel = { register: "Daftar", login: "Masuk", forgot: "Kirim tautan pemulihan", reset: "Simpan kata sandi" }[mode];
  const pendingLabel = { register: "Mendaftarkan...", login: "Memeriksa...", forgot: "Mengirim...", reset: "Menyimpan..." }[mode];
  return <form ref={form} action={formAction} noValidate className="mt-7 space-y-5" aria-busy={pending}
    onReset={() => setRevision((value) => value + 1)}
    onSubmit={(event) => {
      if (lock.current || pending || finished) { event.preventDefault(); return; }
      const invalid = validateAuthForm(mode, new FormData(event.currentTarget));
      setLocalError(invalid);
      if (invalid) {
        event.preventDefault();
        const name = Object.keys(invalid.fieldErrors ?? {})[0];
        event.currentTarget.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
      } else lock.current = true;
    }}
    onBlur={(event) => {
      if (lock.current || pending || !(event.target instanceof HTMLInputElement)) return;
      const name = event.target.name as AuthField;
      const invalid = validateAuthForm(mode, new FormData(event.currentTarget));
      const error = invalid?.fieldErrors?.[name];
      setLocalError((previous) => ({ success: false, message: previous?.message ?? "", fieldErrors: { ...(previous?.fieldErrors ?? state.fieldErrors), [name]: error } }));
    }}>
    <FormAlert state={shown} />
    {!finished && <fieldset disabled={pending} className="min-w-0 space-y-5">
      <legend className="sr-only">{buttonLabel}</legend>
      {mode === "register" && <div><label htmlFor="full_name" className="text-sm font-medium text-[#18312c]">Nama lengkap</label><input id="full_name" name="full_name" autoComplete="name" required maxLength={150} aria-invalid={Boolean(shown.fieldErrors?.full_name)} aria-describedby={shown.fieldErrors?.full_name ? "full_name-error" : undefined} className={inputClass} /><FieldError name="full_name" error={shown.fieldErrors?.full_name} /></div>}
      {mode !== "reset" && <div><label htmlFor="email" className="text-sm font-medium text-[#18312c]">Email</label><input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" required maxLength={254} aria-invalid={Boolean(shown.fieldErrors?.email)} aria-describedby={shown.fieldErrors?.email ? "email-error" : undefined} className={inputClass} /><FieldError name="email" error={shown.fieldErrors?.email} /></div>}
      {mode !== "forgot" && <PasswordField key={`password-${revision}`} name="password" label={mode === "reset" ? "Kata sandi baru" : "Kata sandi"} newPassword={newPassword} error={shown.fieldErrors?.password} />}
      {newPassword && <PasswordField key={`confirmation-${revision}`} name="confirmation" label="Konfirmasi kata sandi" newPassword error={shown.fieldErrors?.confirmation} />}
      {mode === "login" && <div className="text-right"><Link href="/forgot-password" className={`text-sm ${linkClass}`}>Lupa kata sandi?</Link></div>}
      {mode === "forgot" && <p className="text-sm leading-6 text-[#526b61]">Buka tautan pemulihan di browser yang sama dengan permintaan ini.</p>}
      <button type="submit" disabled={pending} className="min-h-12 w-full rounded-xl bg-[#20584c] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2f7162] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20584c] disabled:cursor-wait disabled:opacity-60">{pending ? pendingLabel : buttonLabel}</button>
    </fieldset>}
    {finished && <Link href={mode === "reset" ? "/login?reset=success" : "/login"} className={`block text-center text-sm ${linkClass}`}>Kembali ke halaman masuk</Link>}
  </form>;
}
