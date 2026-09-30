import { PageHeader, Card } from "@/components/ui";
export { Card };
import Link from "next/link";
import type { ReactNode } from "react";
import { initials, roleLabels, membershipLabels } from "@/lib/shell";
import type { AppRole } from "@/config/app";
export function Page({ title, description, breadcrumb, action, children }: { title: string; description?: string; breadcrumb?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <main className="workspace-page"><PageHeader title={title} description={description} breadcrumb={breadcrumb} action={action} /><div className="mt-8 space-y-6">{children}</div></main>;
}
export function Info({ label, value }: { label: string; value?: ReactNode }) {
  return <div className="min-w-0"><dt className="muted text-sm">{label}</dt><dd className="mt-1 break-words font-medium">{value || "Belum diisi"}</dd></div>;
}
export function Avatar({ name }: { name: string }) {
  return <span role="img" aria-label={`Inisial ${name}`} className="ui-avatar">{initials(name)}</span>;
}
export function TenantContext({ school, role, status }: { school: string; role: AppRole | null; status: string }) {

  return <dl className="grid gap-5 sm:grid-cols-3"><Info label="Sekolah aktif" value={school} /><Info label="Peran" value={role ? roleLabels[role] : status === "active" ? "Akses Dasar" : "Belum diisi"} /><Info label="Status akses" value={membershipLabels[status] ?? "Belum tersedia"} /></dl>;
}
export function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link href={href} className="ui-card block hover:border-primary"><h2 className="font-semibold">{title} <span aria-hidden="true">→</span></h2><p className="muted mt-2 text-sm leading-6">{description}</p></Link>;
}
