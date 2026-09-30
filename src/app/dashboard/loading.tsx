import { Skeleton, Spinner } from "@/components/ui";
export default function DashboardLoading() {
  return <main className="workspace-page" aria-busy="true"><p role="status" className="mb-6 flex items-center gap-3"><Spinner />Memuat ruang kerja...</p><div className="ui-card space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></div></main>;
}
