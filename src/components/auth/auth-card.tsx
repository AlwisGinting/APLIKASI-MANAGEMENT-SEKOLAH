import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return <main className="min-h-dvh bg-[#f6f8f5] px-4 py-8 sm:px-8 sm:py-12">
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
      <Link href="/" className="mb-8 flex items-center gap-3 text-sm font-semibold text-[#20584c] focus-visible:outline-2 focus-visible:outline-offset-4"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#20584c] text-lg text-white">K</span>KB DEVFANTA MELATI</Link>
      <section aria-labelledby="auth-title" className="rounded-[2rem] border border-[#dce7e1] bg-white p-6 shadow-[0_20px_60px_rgba(32,88,76,.08)] sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b85e43]">{eyebrow}</p>
        <h1 id="auth-title" className="mt-3 text-3xl font-semibold tracking-tight text-[#18312c]">{title}</h1>
        {description && <p className="mt-3 text-sm leading-6 text-[#60736e]">{description}</p>}
        {children}
        {footer && <div className="mt-7 text-center text-sm leading-6 text-[#60736e]">{footer}</div>}
      </section>
    </div>
  </main>;
}
