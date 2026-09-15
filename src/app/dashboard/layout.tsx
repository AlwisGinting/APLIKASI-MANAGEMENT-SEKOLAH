import { cookies } from "next/headers";
import { getAcademicContext } from "@/lib/academic";
import { switchSchool } from "./tenant/actions";
import { hasCapability } from "@/lib/capabilities";
import { Navigation } from "@/components/dashboard/navigation";
import { FeedbackButton } from "./feedback/feedback-button";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getAcademicContext();
  const store = await cookies();
  const value = store.get("school-ui-theme")?.value;
  const theme = value === "light" || value === "dark" ? value : "system";
  return <div className="dashboard-shell min-h-dvh lg:pl-60" data-theme={theme} data-compact={store.get("school-ui-compact")?.value === "true" ? "true" : "false"}>
    <a href="#dashboard-content" className="surface sr-only z-50 rounded-lg p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati navigasi</a>
    <Navigation name={context.profile?.full_name ?? "Pengguna"} school={context.school.name} role={context.membership.role} />
    <div className="surface border-b px-4 py-3 sm:px-7">
      {context.tenantOptions.length > 1 && <form action={switchSchool} className="mb-3 flex flex-wrap items-center gap-3"><label htmlFor="active-school" className="text-sm font-medium">Sekolah aktif</label><select id="active-school" name="school_id" defaultValue={context.school.id} className="field w-auto">{context.tenantOptions.map(({ school }) => <option key={school.id} value={school.id}>{school.name}</option>)}</select><button type="submit" className="primary-button">Ganti sekolah</button></form>}
      <p className="muted text-sm">{context.school.name}{hasCapability(context, "academic.read") && <> · {context.academicYear?.name ?? "Belum ada tahun ajaran aktif"} · {context.semester?.name ?? "Belum ada semester aktif"}</>}</p>
    </div>
    <div id="dashboard-content" tabIndex={-1} className="pb-24">{children}</div><FeedbackButton />
  </div>;
}
