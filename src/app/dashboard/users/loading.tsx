import { Card, PageHeader, Skeleton } from "@/components/ui";

export default function UsersLoading() {
  return (
    <main className="workspace-page" aria-busy="true">
      <div className="space-y-6">
        <PageHeader
          title="Kelola pengguna"
          description="Memuat daftar pengguna dan peran sekolah..."
        />
        <Card className="p-0 overflow-hidden">
          <div className="border-b p-4">
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid gap-4 p-5 md:grid-cols-4 md:items-center">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-10 w-32 rounded-lg" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-24 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
