import { Skeleton } from "@/components/ui";

export default function MasterLoading() {
  return (
    <main className="min-h-0 bg-[#f6f8f5] px-6 py-10 sm:px-10" aria-busy="true">
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-5 w-44" />
        <div className="mt-8 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-[1.5rem] border border-[#dce7e1] bg-white p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-11 w-11 rounded-2xl" />
                <Skeleton className="h-5 w-5" />
              </div>
              <div className="space-y-2 pt-2">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
