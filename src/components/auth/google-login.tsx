"use client";

import { useActionState, useEffect, useRef } from "react";
import { googleLoginAction } from "@/app/auth/google-actions";
import { initialAuthState } from "@/lib/auth-form";
import { FormAlert } from "./auth-form";

export function GoogleLogin() {
  const [state, action, pending] = useActionState(googleLoginAction, initialAuthState, "/login");
  const lock = useRef(false);
  useEffect(() => { lock.current = false; }, [state]);
  return <div className="mt-6">
    <div className="mb-5 flex items-center gap-3 text-sm text-[#60736e]"><span className="h-px flex-1 bg-[#dce7e1]" /><span>atau</span><span className="h-px flex-1 bg-[#dce7e1]" /></div>
    <form action={action} aria-busy={pending} className="space-y-4" onSubmit={(event) => {
      if (lock.current || pending) { event.preventDefault(); return; }
      lock.current = true;
    }}>
      <FormAlert state={state} />
      <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#9aafa4] bg-white px-4 py-3 text-sm font-semibold text-[#18312c] hover:bg-[#f6f8f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20584c] disabled:cursor-wait disabled:opacity-60">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"/></svg>
        {pending ? "Mengalihkan ke Google..." : "Lanjutkan dengan Google"}
      </button>
    </form>
  </div>;
}
