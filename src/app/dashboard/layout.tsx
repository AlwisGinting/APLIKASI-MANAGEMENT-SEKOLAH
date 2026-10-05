import { cookies } from "next/headers";
import { getAcademicContext } from "@/lib/academic";
import { switchSchool } from "./tenant/actions";
import { hasCapability } from "@/lib/capabilities";
import { Navigation } from "@/components/dashboard/navigation";
import { SchoolContext } from "@/components/dashboard/school-context";
import { FeedbackButton } from "./feedback/feedback-button";
import { NavigationProgress } from "@/components/dashboard/navigation-progress";
import { ToastContainer } from "@/components/ui/toast";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getAcademicContext();
  const store = await cookies();
  const value = store.get("school-ui-theme")?.value;
  const theme = value === "light" || value === "dark" ? value : "system";
  return <div className="dashboard-shell min-h-dvh lg:pl-60" data-theme={theme} data-compact={store.get("school-ui-compact")?.value === "true" ? "true" : "false"}>
    <NavigationProgress />
    <a href="#dashboard-content" className="surface sr-only z-50 rounded-lg p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati navigasi</a>
    <Navigation name={context.profile?.full_name ?? "Pengguna"} school={context.school.name} role={context.membership.role} />
    <SchoolContext school={context.school} schools={context.tenantOptions.map(({ school }) => school)} switchSchool={switchSchool}
      period={hasCapability(context, "academic.read") ? `${context.academicYear?.name ?? "Belum ada tahun ajaran aktif"} · ${context.semester?.name ?? "Belum ada semester aktif"}` : undefined} />
    <div id="dashboard-content" tabIndex={-1} className="pb-24">{children}</div>{hasCapability(context, "feedback.create") && <FeedbackButton />}
    <ToastContainer />
  </div>;
}
