import Link from "next/link";
import type { ReactNode } from "react";
import { initials, roleLabels, membershipLabels } from "@/lib/shell";
import type { AppRole } from "@/config/app";
export function Page({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <main className="workspace-page"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1>{description && <p className="muted mt-3 max-w-3xl leading-7">{description}</p>}<div className="mt-8 space-y-6">{children}</div></main>;
}
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="surface rounded-2xl border p-5 sm:p-6">{title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}{children}</section>;
}
export function Info({ label, value }: { label: string; value?: ReactNode }) {
  return <div className="min-w-0"><dt className="muted text-sm">{label}</dt><dd className="mt-1 break-words font-medium">{value || "Belum diisi"}</dd></div>;
}
export function Avatar({ name }: { name: string }) {
  return <span role="img" aria-label={`Inisial ${name}`} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#20584c] font-semibold text-white">{initials(name)}</span>;
}
export function TenantContext({ school, role, status }: { school: string; role: AppRole | null; status: string }) {

  return <dl className="grid gap-5 sm:grid-cols-3"><Info label="Sekolah aktif" value={school} /><Info label="Role" value={role ? roleLabels[role] : "Belum diisi"} /><Info label="Status membership" value={membershipLabels[status] ?? "Belum tersedia"} /></dl>;
}
export function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link href={href} className="surface block rounded-2xl border p-5 transition hover:border-[#2f7162]"><h2 className="font-semibold">{title} <span aria-hidden="true">→</span></h2><p className="muted mt-2 text-sm leading-6">{description}</p></Link>;
}
