export const ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  MEMBERSHIP_PENDING: "MEMBERSHIP_PENDING",
  MEMBERSHIP_SUSPENDED: "MEMBERSHIP_SUSPENDED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const USER_MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "Silakan masuk untuk melanjutkan.",
  FORBIDDEN: "Anda tidak memiliki akses ke halaman ini.",
  MEMBERSHIP_PENDING: "Akun Anda masih menunggu persetujuan administrator.",
  MEMBERSHIP_SUSPENDED: "Akses sekolah Anda sedang ditangguhkan.",
  VALIDATION_ERROR: "Periksa kembali data yang Anda masukkan.",
  NOT_FOUND: "Data tidak ditemukan.",
  CONFLICT: "Perubahan bertentangan dengan data yang sudah ada.",
  SERVICE_UNAVAILABLE: "Layanan sedang tidak tersedia. Silakan coba kembali beberapa saat lagi.",
  INTERNAL_ERROR: "Layanan sedang tidak tersedia. Silakan coba kembali beberapa saat lagi.",
};

export function classifySupabaseError(error: { code?: string } | null | undefined): ErrorCode {
  if (!error) return ERROR_CODES.INTERNAL_ERROR;
  if (error.code === "23505") return ERROR_CODES.CONFLICT;
  if (error.code === "23514" || error.code === "22P02") return ERROR_CODES.VALIDATION_ERROR;
  if (error.code === "PGRST116") return ERROR_CODES.NOT_FOUND;
  return ERROR_CODES.INTERNAL_ERROR;
}

export function logServerError(code: ErrorCode) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${code}]`);
  }
}
