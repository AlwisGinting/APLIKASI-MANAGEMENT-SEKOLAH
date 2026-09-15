import "server-only";

// Short-lived UX marker, not an authorization credential. Supabase validates
// the authenticated user again before every password update.
export const RECOVERY_COOKIE = "school-password-recovery";
export const RECOVERY_MAX_AGE = 15 * 60;
export const RECOVERY_ERROR = "Tautan pemulihan tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru dan buka di browser yang sama.";
