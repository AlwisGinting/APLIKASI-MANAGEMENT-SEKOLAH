import { Card, Skeleton } from "@/components/ui";

export default function AcademicYearsLoading() {
  return (
    <main className="min-h-0 bg-[#f6f8f5] px-6 py-10 sm:px-10" aria-busy="true">
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-56" />
          </div>
          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>
        <Card className="rounded-[1.5rem] border border-[#dce7e1] bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2 lg:col-span-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="flex items-end">
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </Card>
        <section className="overflow-hidden rounded-[1.5rem] border border-[#dce7e1] bg-white">
          <div className="divide-y divide-[#e6eee9]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between px-6 py-5">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-14 rounded-lg" />
                  <Skeleton className="h-8 w-14 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
