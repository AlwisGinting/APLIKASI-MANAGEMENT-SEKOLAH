import type { ReactNode } from "react";

export function NoPrint({ children }: { children: ReactNode }) {
  return <div className="no-print">{children}</div>;
}

export function PrintOnly({ children }: { children: ReactNode }) {
  return <div className="print-only">{children}</div>;
}

export function PrintablePage({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <article className="print-page">
    <header className="print-page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
    {children}
  </article>;
}
