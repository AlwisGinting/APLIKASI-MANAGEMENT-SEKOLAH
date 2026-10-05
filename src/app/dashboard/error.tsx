"use client";
import { Button, ErrorState } from "@/components/ui";

export default function DashboardError({
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const handleRetry = reset ?? retry;
  return (
    <main className="workspace-page px-4 py-10">
      <div className="ui-card mx-auto max-w-lg">
        <ErrorState action={handleRetry ? <Button onClick={handleRetry}>Coba lagi</Button> : undefined} />
      </div>
    </main>
  );
}
