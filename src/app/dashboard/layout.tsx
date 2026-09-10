import { requireActiveMembership } from "@/lib/auth";
import { FeedbackButton } from "./feedback/feedback-button";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireActiveMembership();
  return <>{children}<FeedbackButton /></>;
}
