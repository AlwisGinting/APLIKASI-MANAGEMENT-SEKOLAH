import "server-only";

// UX marker only: Supabase still authenticates every password update.
export const RECOVERY_COOKIE = "school-password-recovery";
export const RECOVERY_MAX_AGE = 15 * 60;
export const RECOVERY_ERROR = "Buka tautan pemulihan dari email melalui browser dan perangkat tempat Anda meminta pemulihan.";
export const RECOVERY_SERVICE_ERROR = "Pemulihan akun tidak dapat diproses saat ini. Silakan coba kembali.";

export function recoveryFailure(error: { code?: string; name?: string; status?: number } | null | undefined) {
  if (error?.status && error.status >= 500) return "recovery-service";
  if (error?.code === "pkce_code_verifier_not_found" || error?.code === "bad_code_verifier" || error?.name === "AuthPKCECodeVerifierMissingError") return "recovery-browser";
  if (["flow_state_expired", "flow_state_not_found", "otp_expired", "otp_disabled", "invalid_grant"].includes(error?.code ?? "")) return "recovery-invalid";
  return "recovery-service";
}

export function recoveryMessage(reason?: string) {
  if (reason === "recovery-invalid") return "Tautan pemulihan sudah tidak berlaku. Silakan minta tautan baru.";
  if (reason === "recovery-browser") return "Pemulihan perlu dibuka di browser dan perangkat tempat Anda meminta tautan. Jika data browser telah dihapus, minta tautan baru dari browser ini.";
  if (reason) return RECOVERY_SERVICE_ERROR;
  return RECOVERY_ERROR;
}
