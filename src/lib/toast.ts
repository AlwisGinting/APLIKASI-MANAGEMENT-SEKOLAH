export type ToastTone = "success" | "destructive" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  title?: string;
  duration?: number;
};

type Listener = () => void;

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 4000;
let toasts: readonly Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getToasts(): readonly Toast[] {
  return toasts;
}

export function dismissToast(id: string): void {
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

export function clearToasts(): void {
  toasts = [];
  notify();
}

export function addToast(message: string, tone: ToastTone = "info", options: { title?: string; duration?: number } = {}): string {
  if (!message || typeof message !== "string") return "";
  // Sanitize: ensure no raw stack traces, database internals or sensitive error details are shown
  const safeMessage = /SQL|column|constraint|password|token|secret/i.test(message) && /error|failed|exception/i.test(message)
    ? "Terjadi kesalahan pada sistem. Silakan coba kembali."
    : message.trim().slice(0, 300);
  const id = `toast-${nextId++}`;
  const duration = options.duration ?? (tone === "destructive" ? 6000 : DEFAULT_DURATION);
  const newToast: Toast = { id, message: safeMessage, tone, title: options.title, duration };
  toasts = [...toasts.slice(-(MAX_TOASTS - 1)), newToast];
  notify();

  if (duration > 0 && typeof window !== "undefined") {
    window.setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
  return id;
}

export const toast = {
  success: (msg: string, title?: string) => addToast(msg, "success", { title }),
  error: (msg: string, title?: string) => addToast(msg, "destructive", { title }),
  info: (msg: string, title?: string) => addToast(msg, "info", { title }),
  warning: (msg: string, title?: string) => addToast(msg, "warning", { title }),
  dismiss: dismissToast,
  clear: clearToasts,
};
