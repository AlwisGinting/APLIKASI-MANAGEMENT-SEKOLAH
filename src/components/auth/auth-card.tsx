import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return <main className="min-h-dvh bg-background px-4 py-8 sm:px-8 sm:py-12">
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
      <Link href="/" className="mb-8 flex items-center gap-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-lg text-white">K</span>KB DEVFANTA MELATI</Link>
      <section aria-labelledby="auth-title" className="ui-card">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 id="auth-title" className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-3 text-sm leading-6 text-muted">{description}</p>}
        {children}
        {footer && <div className="mt-7 text-center text-sm leading-6 text-muted">{footer}</div>}
      </section>
    </div>
  </main>;
}
