import { Card, PageHeader, Skeleton } from "@/components/ui";

export default function ActivityLoading() {
  return (
    <main className="workspace-page" aria-busy="true">
      <div className="space-y-6">
        <PageHeader
          title="Aktivitas"
          description="Memuat riwayat aktivitas sekolah dan ringkasan akun Anda..."
        />
        <Card title="Riwayat perubahan sekolah">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-l-2 pl-5 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Ringkasan akun Anda">
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-l-2 pl-5 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
