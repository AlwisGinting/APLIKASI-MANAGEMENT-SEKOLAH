import type { ComponentProps, ReactNode } from "react";

const cx = (...values: (string | undefined)[]) => values.filter(Boolean).join(" ");
export type Tone = "neutral" | "success" | "warning" | "destructive" | "info";
export function Spinner() { return <span aria-hidden="true" className="ui-spinner" />; }
export function Button({ variant = "primary", loading = false, disabled, className, children, type = "button", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive"; loading?: boolean }) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cx("ui-button", `ui-button-${variant}`, className)}>{loading && <Spinner />}{children}</button>;
}
export function Input({ className, ...props }: ComponentProps<"input">) { return <input {...props} className={cx("field", className)} />; }
export function Textarea({ className, ...props }: ComponentProps<"textarea">) { return <textarea {...props} className={cx("field", className)} />; }
export function Select({ className, ...props }: ComponentProps<"select">) { return <select {...props} className={cx("field", className)} />; }
export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) { return <input {...props} type="checkbox" className={cx("ui-checkbox", className)} />; }
export function Label({ className, ...props }: ComponentProps<"label">) { return <label {...props} className={cx("ui-label", className)} />; }
export function FieldError({ id, children }: { id: string; children?: ReactNode }) { return children ? <p id={id} className="ui-field-error">{children}</p> : null; }
export function FieldDescription({ id, children }: { id: string; children: ReactNode }) { return <p id={id} className="muted mt-2 text-sm">{children}</p>; }
// Controls receive this object explicitly so labels, descriptions and errors stay linked.
export function Field({ id, label, description, error, children }: { id: string; label: string; description?: string; error?: string; children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode }) {
  const described = [description && `${id}-description`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className="min-w-0"><Label htmlFor={id}>{label}</Label>{children({ id, "aria-invalid": Boolean(error), "aria-describedby": described })}{description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}<FieldError id={`${id}-error`}>{error}</FieldError></div>;
}
export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) { return <section className={cx("ui-card", className)}>{title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}{children}</section>; }
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) { return <span className={`ui-badge ui-tone-${tone}`}>{children}</span>; }
export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) { return <div role={tone === "destructive" ? "alert" : "status"} className={`ui-alert ui-tone-${tone}`}>{title && <p className="font-semibold">{title}</p>}<div>{children}</div></div>; }
export function Separator() { return <hr className="ui-separator" />; }
export function Skeleton({ className }: { className?: string }) { return <div aria-hidden="true" className={cx("ui-skeleton", className)} />; }
export function PageHeader({ title, description, breadcrumb, action }: { title: string; description?: string; breadcrumb?: ReactNode; action?: ReactNode }) { return <header className="ui-page-header">{breadcrumb && <nav aria-label="Jejak halaman" className="muted text-sm">{breadcrumb}</nav>}<div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><h1>{title}</h1>{description && <p className="muted mt-3 max-w-3xl leading-7">{description}</p>}</div>{action && <div className="max-w-full">{action}</div>}</div></header>; }
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) { return <div className="ui-empty"><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="muted mt-2 leading-7">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>; }
export function ErrorState({ action }: { action?: ReactNode }) { return <EmptyState title="Layanan sedang tidak tersedia" description="Silakan coba kembali beberapa saat lagi. Jika masalah berlanjut, hubungi administrator sekolah." action={action} />; }
