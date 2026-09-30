"use client";
import { Button, ErrorState } from "@/components/ui";
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="workspace-page px-4 py-10"><div className="ui-card mx-auto max-w-lg"><ErrorState action={<Button onClick={retry}>Coba lagi</Button>} /></div></main>;
}
