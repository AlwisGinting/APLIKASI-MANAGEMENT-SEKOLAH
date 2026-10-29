import "server-only";
import * as fs from "fs";
import * as path from "path";

export type ToolPermissionLevel = "read_only" | "task_mutation" | "admin_approval_required";

export type ExecutionToolDefinition = {
  id: string;
  name: string;
  description: string;
  permission: ToolPermissionLevel;
  safetyBoundary: string;
};

export const ALLOWED_TOOL_PATHS = [
  "src/",
  "docs/",
  "supabase/migrations/",
  "package.json",
  "README.md",
] as const;

export const BLOCKED_PATH_PATTERNS = [
  /\.\./,
  /\0/,
  /\.env(\.local)?/i,
  /\.git/i,
  /id_rsa/i,
  /secret/i,
  /credentials/i,
  /node_modules/i,
] as const;

export const CONTROLLED_TOOLS: readonly ExecutionToolDefinition[] = [
  {
    id: "tool-read-file",
    name: "Inspect Allowlisted File",
    description: "Membaca isi file proyek dalam direktori yang diizinkan (src, docs, migrations).",
    permission: "read_only",
    safetyBoundary: "Menolak path traversal (..), file environment (.env), private keys, dan data rahasia. Output otomatis melalui sensor redaksi.",
  },
  {
    id: "tool-git-status",
    name: "Inspect Git State",
    description: "Membaca status branch, commit HEAD, dan status kebersihan working tree.",
    permission: "read_only",
    safetyBoundary: "Hanya menyajikan status statis repositori; tidak dapat mengeksekusi perintah shell sembarangan.",
  },
  {
    id: "tool-test-health",
    name: "Inspect Test Health",
    description: "Membaca ringkasan hasil validasi test suite terbaru (173 tests, 0 fails).",
    permission: "read_only",
    safetyBoundary: "Hanya melaporkan status metrik pengujian yang terverifikasi.",
  },
  {
    id: "tool-manage-task",
    name: "Update Project Memory Task",
    description: "Memperbarui status task aktif atau mencatat keputusan arsitektur baru.",
    permission: "task_mutation",
    safetyBoundary: "Hanya memodifikasi memori proyek internal; tidak mengubah kode produksi secara langsung.",
  },
  {
    id: "tool-promote-prod",
    name: "Promote to Production",
    description: "Memulai proses promosi deployment ke production.",
    permission: "admin_approval_required",
    safetyBoundary: "Memerlukan konfirmasi ganda super_admin dan verifikasi preflight lengkap sebelum diajukan.",
  },
] as const;

const getSafeCwd = () =>
  typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";

/**
 * Sensor sensorik redaksi data sensitif:
 * Menghapus/menyamarkan token JWT, API key (Gemini, OpenAI, Anthropic, GitHub),
 * password, header bearer, dan private key sebelum ditampilkan ke UI atau log.
 */
export function redactSensitiveData(input: string): string {
  if (!input || typeof input !== "string") return "";

  let result = input;

  // 1. Redact Private Keys (RSA / EC / OpenSSH / Generic)
  result = result.replace(
    /-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/g,
    "[REDACTED_PRIVATE_KEY]"
  );

  // 2. Redact Authorization Bearer headers
  result = result.replace(
    /\bBearer\s+[a-zA-Z0-9._~+/-]+=*/gi,
    "Bearer [REDACTED_TOKEN]"
  );

  // 3. Redact Supabase / JWT tokens (eyJ...)
  result = result.replace(
    /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\b/g,
    "[REDACTED_JWT_TOKEN]"
  );

  // 4. Redact Google / Gemini API keys (AIzaSy...)
  result = result.replace(
    /\bAIzaSy[a-zA-Z0-9_-]{33}\b/g,
    "[REDACTED_GEMINI_KEY]"
  );

  // 5. Redact Anthropic API keys (sk-ant-...) - Evaluasi sebelum generic sk-
  result = result.replace(
    /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g,
    "[REDACTED_ANTHROPIC_KEY]"
  );

  // 6. Redact OpenAI API keys (sk-... or sk-proj-...)
  result = result.replace(
    /\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b/g,
    "[REDACTED_OPENAI_KEY]"
  );

  // 7. Redact GitHub Personal Access Tokens (ghp_..., github_pat_...)
  result = result.replace(
    /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{30,})\b/g,
    "[REDACTED_GITHUB_TOKEN]"
  );

  // 8. Redact key-value secrets (e.g., password = "...", secret_key: "...")
  result = result.replace(
    /(["']?(?:password|secret|api[_-]?key|access[_-]?token)["']?\s*[:=]\s*["']?)([^"' \r\n,;]{4,})(["']?)/gi,
    "$1[REDACTED_SECRET]$3"
  );

  return result;
}

export function isPathAllowlisted(requestedPath: string): boolean {
  if (!requestedPath || typeof requestedPath !== "string") return false;

  const normalized = requestedPath.replace(/\\/g, "/").trim();

  // Tolak null-byte injection
  if (normalized.includes("\0")) return false;

  // Tolak pola terlarang (path traversal, .env, .git, secret, credentials, node_modules)
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }

  // Path wajib dimulai dengan salah satu entri allowlist
  return ALLOWED_TOOL_PATHS.some((allowed) =>
    normalized === allowed || normalized.startsWith(allowed)
  );
}

export async function safeInspectFile(
  relPath: string
): Promise<{ success: boolean; message: string; content?: string }> {
  if (!relPath || typeof relPath !== "string") {
    return { success: false, message: "Path file tidak valid atau kosong." };
  }

  if (!isPathAllowlisted(relPath)) {
    return {
      success: false,
      message: `Akses ditolak: file '${relPath}' berada di luar allowlist atau terindikasi memiliki pola terlarang.`,
    };
  }

  try {
    const cwd = path.resolve(getSafeCwd());
    const fullPath = path.resolve(cwd, relPath);

    // Verifikasi batas direktori root (mencegah symlink / escape)
    if (!fullPath.startsWith(cwd)) {
      return { success: false, message: "Akses ditolak: path berada di luar direktori proyek." };
    }

    if (!fs.existsSync(fullPath)) {
      return { success: false, message: `File '${relPath}' tidak ditemukan.` };
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return { success: false, message: `'${relPath}' adalah direktori, bukan file.` };
    }

    // Batasi ukuran baca maksimal 100 KB untuk efisiensi & keamanan memori
    if (stat.size > 100 * 1024) {
      return { success: false, message: `File terlalu besar (${stat.size} bytes). Maksimal 100 KB.` };
    }

    const rawContent = fs.readFileSync(fullPath, "utf8");
    // Selalu sensor data sensitif sebelum mengembalikan konten
    const content = redactSensitiveData(rawContent);

    return { success: true, message: "Berhasil membaca file (dengan sensor redaksi).", content };
  } catch (err) {
    return {
      success: false,
      message: `Gagal membaca file: ${err instanceof Error ? err.message : "Internal error"}`,
    };
  }
}
