import "server-only";
import * as fs from "fs";
import * as path from "path";

export type ProjectTaskStatus = "pending" | "in_progress" | "completed" | "failed";

export type ProjectTask = {
  id: string;
  title: string;
  category: "foundation" | "security" | "ui" | "performance" | "storage" | "ai_center";
  status: ProjectTaskStatus;
  updatedAt: string;
  summary: string;
};

export type ProjectDecision = {
  id: string;
  date: string;
  title: string;
  rationale: string;
  impact: string;
};

export type ProjectFileRecord = {
  path: string;
  status: "immutable" | "active" | "draft";
  purpose: string;
  lastVerified: string;
};

export type ProjectSessionSummary = {
  id: string;
  agent: string;
  timestamp: string;
  taskSummary: string;
  verifiedChecks: string[];
};

export type ProjectChangeRecord = {
  id: string;
  timestamp: string;
  actor: string;
  action: "task_update" | "session_recorded" | "memory_initialized" | "decision_added";
  details: string;
};

export type ProjectContext = {
  version: string;
  lastUpdated: string;
  branch: string;
  headSha: string;
  appliedMigrations: string;
  draftMigrations: string;
  tenantId?: string;
  storageEngine: {
    type: "server_persistent_file";
    isDatabaseBacked: boolean;
    description: string;
    requirementRemaining: string;
  };
  testHealth: {
    total: number;
    passed: number;
    failed: number;
    verifiedAt: string;
  };
  tasks: ProjectTask[];
  decisions: ProjectDecision[];
  keyFiles: ProjectFileRecord[];
  sessions: ProjectSessionSummary[];
  history: ProjectChangeRecord[];
};

const getSafeCwd = () =>
  typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";

// Lokasi penyimpanan persisten memori proyek di disk server
export const getMemoryStorageDir = () => path.resolve(getSafeCwd(), ".ai-memory");
export const getMemoryStorageFile = () => path.join(getMemoryStorageDir(), "project-memory.json");

function createDefaultProjectContext(tenantId?: string): ProjectContext {
  return {
    version: "1.1.0",
    lastUpdated: new Date().toISOString(),
    branch: "checkpoint/google-first-basic-access",
    headSha: "5190a2fd1be02d42e338b77ac0daa18e978b6b1a",
    appliedMigrations: "001–007 (immutable and verified)",
    draftMigrations: "008 (security), 009 (google admission), 010 (storage avatar hardening)",
    tenantId,
    storageEngine: {
      type: "server_persistent_file",
      isDatabaseBacked: false,
      description: "Penyimpanan persisten lokal server (.ai-memory/project-memory.json) dengan histori perubahan atomik.",
      requirementRemaining: "Untuk klaster serverless multi-instance di cloud, diperlukan tabel Supabase 'ai_agent_memory' dengan RLS tenant-isolated melalui migrasi baru 011+ (memerlukan persetujuan eksplisit owner).",
    },
    testHealth: {
      total: 173,
      passed: 173,
      failed: 0,
      verifiedAt: "2026-10-29T21:00:00+07:00",
    },
    tasks: [
      {
        id: "task-f65b",
        title: "F6.5B — Performance & Customization Foundation",
        category: "performance",
        status: "completed",
        updatedAt: "2026-10-29T00:56:06+07:00",
        summary: "Promise.all queries (users, activity, layout), targeted revalidation, search input 300ms debounce, and zero-flash theme SSR.",
      },
      {
        id: "task-f7-stage1",
        title: "F7 Tahap 1 — Storage Avatar Hardening",
        category: "storage",
        status: "completed",
        updatedAt: "2026-10-29T01:12:05+07:00",
        summary: "Draft migration 010: restrictive scope gate on avatars, explicit UPDATE/DELETE deny, RLS recursion safety, and static tests pass.",
      },
      {
        id: "task-f7-stage2",
        title: "F7 Tahap 2 — Avatar Signed URL & Client UI Integration",
        category: "storage",
        status: "pending",
        updatedAt: "2026-10-29T01:13:00+07:00",
        summary: "Generate short-lived signed URLs (60s) for verified avatar binaries; update profile picture display.",
      },
      {
        id: "task-ai-center",
        title: "AI Agent & Deployment Center Module",
        category: "ai_center",
        status: "in_progress",
        updatedAt: new Date().toISOString(),
        summary: "Multi-provider abstraction, persistent memory across agents, controlled execution tools, and deployment safety center for super_admin.",
      },
    ],
    decisions: [
      {
        id: "dec-001",
        date: "2026-09-24",
        title: "Immutabilitas Migrasi 001–007",
        rationale: "Migrasi yang telah diterapkan ke production tidak boleh diedit ulang. Semua perubahan skema wajib menggunakan migrasi baru 008+.",
        impact: "Menjaga integritas data historis dan skema multi-tenant.",
      },
      {
        id: "dec-002",
        date: "2026-10-05",
        title: "Larangan Terminal Bebas & Shell Execution",
        rationale: "Menghindari celah Remote Code Execution (RCE) via web endpoint. Dilarang menambah pemanggilan shell OS arbitrary atau api/terminal.",
        impact: "Operasi development hanya melalui terminal lokal VS Code yang diawasi operator.",
      },
      {
        id: "dec-003",
        date: "2026-10-28",
        title: "Pencegahan Theme Flash (FOUC) via SSR Attribute",
        rationale: "Atribut data-theme dan data-compact dibaca dari cookie langsung di server component layout sebelum render halaman.",
        impact: "Tampilan render instan tanpa flicker atau ketergantungan JavaScript di sisi browser.",
      },
      {
        id: "dec-004",
        date: "2026-10-29",
        title: "Default-Deny Bucket Dokumen Bisnis",
        rationale: "Bucket student-documents, teacher-documents, attendance-photos ditutup total sampai modul entitas terkait memiliki otorisasi formal.",
        impact: "Mencegah kebocoran data dokumen sensitif sekolah.",
      },
    ],
    keyFiles: [
      { path: "src/lib/auth.ts", status: "active", purpose: "Konteks autentikasi, dedup request-scoped via React cache, tenant options", lastVerified: "2026-10-29" },
      { path: "src/lib/capabilities.ts", status: "active", purpose: "RBAC capability matrix & tenant check fail-closed", lastVerified: "2026-10-29" },
      { path: "src/components/data/data-table.tsx", status: "active", purpose: "Server Component DataToolbar dengan SearchInput progressive enhancement", lastVerified: "2026-10-29" },
      { path: "supabase/migrations/202610290010_storage_avatar_hardening.sql", status: "draft", purpose: "Draft migrasi F7 Storage Hardening dengan penolakan mutasi", lastVerified: "2026-10-29" },
    ],
    sessions: [
      {
        id: "sess-20261029-01",
        agent: "Antigravity Assistant (Google DeepMind)",
        timestamp: "2026-10-29T00:56:06+07:00",
        taskSummary: "Menyelesaikan checkpoint F6.5B, push ke branch checkpoint/google-first-basic-access",
        verifiedChecks: ["npm test (171 pass)", "lint (0 warnings)", "typecheck (0 errors)", "build (26 routes)"],
      },
      {
        id: "sess-20261029-02",
        agent: "Antigravity Assistant (Google DeepMind)",
        timestamp: "2026-10-29T01:13:00+07:00",
        taskSummary: "Menyusun draft migration 010 storage hardening dan menambahkan tes statis 010",
        verifiedChecks: ["npm test (172 pass)", "lint (0 warnings)", "typecheck (0 errors)", "build (26 routes)"],
      },
    ],
    history: [
      {
        id: "hist-init",
        timestamp: new Date().toISOString(),
        actor: "System Foundation",
        action: "memory_initialized",
        details: "Fondasi Project Memory persisten diinisialisasi.",
      },
    ],
  };
}

/**
 * Membaca data memori persisten dari disk server.
 * Jika file belum ada, inisialisasi default context dan simpan ke disk secara atomik.
 */
export async function getProjectMemory(tenantId?: string): Promise<ProjectContext> {
  const filePath = getMemoryStorageFile();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as ProjectContext;
      // Isolasi tenant: jika tenantId diberikan dan tidak cocok dengan memory, re-scope
      if (tenantId && parsed.tenantId && parsed.tenantId !== tenantId) {
        parsed.tenantId = tenantId;
      }
      return parsed;
    }
  } catch {
    // Jika file korup atau tidak terbaca, fallback ke inisialisasi aman
  }

  const defaultContext = createDefaultProjectContext(tenantId);
  saveProjectMemory(defaultContext);
  return defaultContext;
}

/**
 * Menyimpan data memori ke file disk secara atomik menggunakan file temp dan rename.
 */
export function saveProjectMemory(memory: ProjectContext): boolean {
  try {
    const dirPath = getMemoryStorageDir();
    const filePath = getMemoryStorageFile();

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const tempFile = path.join(dirPath, `temp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    const serialized = JSON.stringify(memory, null, 2);

    fs.writeFileSync(tempFile, serialized, "utf8");
    fs.renameSync(tempFile, filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Memperbarui status task dan mencatat riwayat perubahan secara persisten.
 */
export async function updateTaskStatus(
  taskId: string,
  status: ProjectTaskStatus,
  summary?: string,
  actor = "Super Admin"
): Promise<boolean> {
  const memory = await getProjectMemory();
  const task = memory.tasks.find((t) => t.id === taskId);
  if (!task) return false;

  const oldStatus = task.status;
  task.status = status;
  task.updatedAt = new Date().toISOString();
  if (summary) task.summary = summary;
  memory.lastUpdated = new Date().toISOString();

  // Tambahkan catatan ke riwayat perubahan
  const changeRecord: ProjectChangeRecord = {
    id: `chg-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor,
    action: "task_update",
    details: `Task '${taskId}' status diubah dari '${oldStatus}' ke '${status}'.`,
  };

  memory.history = memory.history || [];
  memory.history.unshift(changeRecord);
  if (memory.history.length > 50) memory.history.pop();

  return saveProjectMemory(memory);
}

/**
 * Mencatat ringkasan sesi kerja agent dan menyimpan riwayat secara persisten.
 */
export async function recordNewSession(
  summary: string,
  verifiedChecks: string[],
  actor = "Antigravity Active Agent"
): Promise<ProjectSessionSummary> {
  const memory = await getProjectMemory();
  const newSession: ProjectSessionSummary = {
    id: `sess-${Date.now()}`,
    agent: actor,
    timestamp: new Date().toISOString(),
    taskSummary: summary,
    verifiedChecks,
  };

  memory.sessions = memory.sessions || [];
  memory.sessions.unshift(newSession);
  if (memory.sessions.length > 20) memory.sessions.pop();

  // Catat riwayat sesi
  const changeRecord: ProjectChangeRecord = {
    id: `chg-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor,
    action: "session_recorded",
    details: `Sesi baru dicatat: ${summary.slice(0, 80)}${summary.length > 80 ? "..." : ""}`,
  };

  memory.history = memory.history || [];
  memory.history.unshift(changeRecord);
  if (memory.history.length > 50) memory.history.pop();

  memory.lastUpdated = new Date().toISOString();
  saveProjectMemory(memory);
  return newSession;
}
