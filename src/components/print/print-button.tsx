"use client";

import { Button } from "@/components/ui";

export function PrintButton({ label = "Cetak / Simpan PDF" }: { label?: string }) {
  return <Button type="button" variant="outline" className="no-print" onClick={() => window.print()} aria-label={label}>{label}</Button>;
}
