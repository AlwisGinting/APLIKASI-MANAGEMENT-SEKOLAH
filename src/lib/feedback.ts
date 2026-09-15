import { APP_CONFIG } from "@/config/app";
import { safeNextPath } from "@/lib/redirect";
export const feedbackUnavailable = "Ruang feedback belum tersedia. Silakan hubungi admin sekolah.";
export function feedbackPath(value: unknown) {
  if (typeof value !== "string" || value.length > APP_CONFIG.feedback.currentPathMaxLength) return null;
  const path = safeNextPath(value.trim(), "");
  // Store only the pathname; query strings/fragments can contain sensitive data.
  return path.split(/[?#]/)[0] || null;
}
export function feedbackTableMissing(error: { code?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}
