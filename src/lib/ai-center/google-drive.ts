import "server-only";
import * as fs from "fs";
import * as path from "path";
import { encryptSecret, decryptSecret } from "@/lib/ai-center/key-management";
import { getProjectMemory } from "@/lib/ai-center/memory";
import { redactSensitiveData } from "@/lib/ai-center/tools";

export const DRIVE_CONFIG = {
  rootFolderName: "DEVFANTA MELATI - AI Agent",
  subfolders: ["Memory", "Sessions", "Tasks", "Documents", "Backups"] as const,
  defaultAccountEmail: "alwisginting@gmail.com",
  scope: "https://www.googleapis.com/auth/drive.file",
};

export type DriveSubfolderStatus = {
  name: string;
  status: "synced" | "pending" | "missing";
  remoteId?: string;
};

export type GoogleDriveState = {
  connected: boolean;
  status: "connected" | "not_connected" | "authorization_required";
  statusText: string;
  accountEmail: string;
  configuredViaEnv: boolean;
  clientIdConfigured: boolean;
  rootFolder: {
    name: string;
    id?: string;
    status: "ready" | "pending" | "missing";
  };
  subfolders: DriveSubfolderStatus[];
  lastSyncedAt?: string;
  syncStatus: "idle" | "synced" | "error" | "unconnected";
  syncMessage: string;
  syncedFilesCount: number;
};

type StoredDriveTokens = {
  accountEmail: string;
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  expiresAt?: number;
  rootFolderId?: string;
  subfolderIds?: Record<string, string>;
  lastSyncedAt?: string;
  syncMessage?: string;
};

function getSafeCwd(): string {
  return typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";
}

const DRIVE_STORE_DIR = path.resolve(getSafeCwd(), ".ai-memory");
const DRIVE_STORE_FILE = path.join(DRIVE_STORE_DIR, "drive-connection.json");

function loadStoredTokens(): StoredDriveTokens {
  try {
    if (fs.existsSync(DRIVE_STORE_FILE)) {
      const raw = fs.readFileSync(DRIVE_STORE_FILE, "utf8");
      return JSON.parse(raw) as StoredDriveTokens;
    }
  } catch {
    // Fallback
  }
  return {
    accountEmail: DRIVE_CONFIG.defaultAccountEmail,
  };
}

function saveStoredTokens(data: StoredDriveTokens): boolean {
  try {
    if (!fs.existsSync(DRIVE_STORE_DIR)) {
      fs.mkdirSync(DRIVE_STORE_DIR, { recursive: true });
    }
    const tempFile = path.join(DRIVE_STORE_DIR, `temp-drive-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, DRIVE_STORE_FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Menghasilkan URL otorisasi OAuth resmi Google Drive.
 */
export function getGoogleDriveOAuthUrl(options?: {
  origin?: string;
  loginHint?: string;
}): { url: string; configured: boolean; message?: string } {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return {
      url: "",
      configured: false,
      message: "GOOGLE_DRIVE_CLIENT_ID belum terdaftar di environment server.",
    };
  }

  const baseOrigin = options?.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${baseOrigin}/api/auth/google-drive/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `openid email ${DRIVE_CONFIG.scope}`,
    access_type: "offline",
    prompt: "select_account consent",
    login_hint: options?.loginHint || DRIVE_CONFIG.defaultAccountEmail,
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    configured: true,
  };
}

/**
 * Membaca status koneksi dan struktur folder Google Drive.
 */
export async function getGoogleDriveState(): Promise<GoogleDriveState> {
  const stored = loadStoredTokens();
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const hasToken = Boolean(stored.encryptedRefreshToken || stored.encryptedAccessToken);

  const subfolders: DriveSubfolderStatus[] = DRIVE_CONFIG.subfolders.map((name) => ({
    name,
    status: stored.subfolderIds?.[name] ? "synced" : hasToken ? "pending" : "missing",
    remoteId: stored.subfolderIds?.[name],
  }));

  const isConnected = hasToken && Boolean(clientId);

  return {
    connected: isConnected,
    status: isConnected ? "connected" : hasToken ? "authorization_required" : "not_connected",
    statusText: isConnected
      ? `Terkoneksi ke Google Drive (${stored.accountEmail})`
      : hasToken
      ? `Menunggu Verifikasi Client OAuth (${stored.accountEmail})`
      : `Belum Terhubung ke Google Drive (${stored.accountEmail})`,
    accountEmail: stored.accountEmail || DRIVE_CONFIG.defaultAccountEmail,
    configuredViaEnv: Boolean(clientId),
    clientIdConfigured: Boolean(clientId),
    rootFolder: {
      name: DRIVE_CONFIG.rootFolderName,
      id: stored.rootFolderId,
      status: stored.rootFolderId ? "ready" : hasToken ? "pending" : "missing",
    },
    subfolders,
    lastSyncedAt: stored.lastSyncedAt,
    syncStatus: isConnected ? (stored.lastSyncedAt ? "synced" : "idle") : "unconnected",
    syncMessage: isConnected
      ? stored.syncMessage || "Koneksi Google Drive aktif. Siap melakukan sinkronisasi memori proyek."
      : "Koneksi Google Drive belum aktif. Lakukan otorisasi akun Google untuk mengaktifkan sinkronisasi cloud.",
    syncedFilesCount: stored.lastSyncedAt ? (stored.subfolderIds ? Object.keys(stored.subfolderIds).length + 1 : 1) : 0,
  };
}

/**
 * Menyimpan token OAuth yang telah berhasil di-exchange secara terenkripsi.
 */
export async function saveGoogleDriveTokens(params: {
  accountEmail: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}): Promise<boolean> {
  const stored = loadStoredTokens();
  stored.accountEmail = params.accountEmail || DRIVE_CONFIG.defaultAccountEmail;
  stored.encryptedAccessToken = encryptSecret(params.accessToken);
  if (params.refreshToken) {
    stored.encryptedRefreshToken = encryptSecret(params.refreshToken);
  }
  if (params.expiresIn) {
    stored.expiresAt = Date.now() + params.expiresIn * 1000;
  }
  return saveStoredTokens(stored);
}

/**
 * Mengganti akun target Google Drive (misalnya berganti dari alwisginting@gmail.com ke akun lain).
 */
export async function updateGoogleDriveAccount(newEmail: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = newEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, message: "Format email tidak valid." };
  }

  const stored = loadStoredTokens();
  const oldEmail = stored.accountEmail;
  stored.accountEmail = cleanEmail;
  // Reset token jika berpindah akun agar tidak terjadi konflik hak akses
  if (oldEmail !== cleanEmail) {
    delete stored.encryptedAccessToken;
    delete stored.encryptedRefreshToken;
    delete stored.rootFolderId;
    delete stored.subfolderIds;
    delete stored.lastSyncedAt;
    stored.syncMessage = `Akun diubah ke ${cleanEmail}. Memerlukan otorisasi ulang Google Drive.`;
  }

  saveStoredTokens(stored);
  return {
    success: true,
    message: `Akun Google Drive diubah ke '${cleanEmail}'. Silakan hubungkan kembali via OAuth.`,
  };
}

/**
 * Memutus koneksi Google Drive dan menghapus token terenkripsi dari server.
 */
export async function disconnectGoogleDrive(): Promise<{ success: boolean; message: string }> {
  const stored = loadStoredTokens();
  delete stored.encryptedAccessToken;
  delete stored.encryptedRefreshToken;
  delete stored.rootFolderId;
  delete stored.subfolderIds;
  delete stored.lastSyncedAt;
  stored.syncMessage = "Koneksi Google Drive telah diputus.";

  saveStoredTokens(stored);
  return { success: true, message: "Koneksi Google Drive berhasil diputus." };
}

/**
 * Memastikan struktur folder 'DEVFANTA MELATI - AI Agent' dan subfoldernya tersedia di Google Drive.
 * Jika terkoneksi via OAuth live API, melakukan panggilan REST API resmi Google Drive v3.
 * Jika belum terkoneksi, mencatat status belum terhubung secara jujur.
 */
export async function ensureDriveFolderStructure(): Promise<{
  success: boolean;
  message: string;
  rootFolderId?: string;
  subfolders?: Record<string, string>;
}> {
  const stored = loadStoredTokens();
  if (!stored.encryptedAccessToken && !stored.encryptedRefreshToken) {
    return {
      success: false,
      message: "Gagal: Google Drive belum terhubung via OAuth. Token tidak ditemukan.",
    };
  }

  let accessToken = "";
  try {
    if (stored.encryptedAccessToken) {
      accessToken = decryptSecret(stored.encryptedAccessToken);
    }
  } catch {
    return { success: false, message: "Token akses tidak dapat didekripsi." };
  }

  // Jika token live tersedia, lakukan pemanggilan Google Drive REST API
  if (accessToken) {
    try {
      // 1. Cari atau buat root folder 'DEVFANTA MELATI - AI Agent'
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `name = '${DRIVE_CONFIG.rootFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
        )}&fields=files(id,name)`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as { files: Array<{ id: string; name: string }> };
        let rootId = searchData.files[0]?.id;

        if (!rootId) {
          // Buat root folder baru
          const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: DRIVE_CONFIG.rootFolderName,
              mimeType: "application/vnd.google-apps.folder",
            }),
          });
          if (createRes.ok) {
            const createData = (await createRes.json()) as { id: string };
            rootId = createData.id;
          }
        }

        if (rootId) {
          stored.rootFolderId = rootId;
          stored.subfolderIds = stored.subfolderIds || {};

          // 2. Buat subfolder Memory, Sessions, Tasks, Documents, Backups
          for (const sub of DRIVE_CONFIG.subfolders) {
            const subSearch = await fetch(
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
                `name = '${sub}' and '${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
              )}&fields=files(id,name)`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (subSearch.ok) {
              const subData = (await subSearch.json()) as { files: Array<{ id: string; name: string }> };
              let subId = subData.files[0]?.id;

              if (!subId) {
                const subCreate = await fetch("https://www.googleapis.com/drive/v3/files", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    name: sub,
                    mimeType: "application/vnd.google-apps.folder",
                    parents: [rootId],
                  }),
                });
                if (subCreate.ok) {
                  const createdSub = (await subCreate.json()) as { id: string };
                  subId = createdSub.id;
                }
              }

              if (subId) {
                stored.subfolderIds[sub] = subId;
              }
            }
          }

          saveStoredTokens(stored);
          return {
            success: true,
            message: `Struktur folder '${DRIVE_CONFIG.rootFolderName}' dan 5 subfolder terverifikasi di Google Drive.`,
            rootFolderId: rootId,
            subfolders: stored.subfolderIds,
          };
        }
      }
    } catch (err) {
      return {
        success: false,
        message: `Koneksi Google Drive API mengalami galat: ${err instanceof Error ? redactSensitiveData(err.message) : "Network error"}`,
      };
    }
  }

  // Jika token belum terhubung ke API Google nyata
  return {
    success: false,
    message: "Google Drive OAuth belum terhubung. Daftarkan GOOGLE_DRIVE_CLIENT_ID dan lakukan otorisasi akun.",
  };
}

/**
 * Sinkronisasi Project Memory ke Google Drive.
 * Mengunggah file project-memory.json ke subfolder 'Memory' di Drive.
 */
export async function syncProjectMemoryToDrive(): Promise<{
  success: boolean;
  message: string;
  lastSyncedAt?: string;
}> {
  const stored = loadStoredTokens();
  if (!stored.encryptedAccessToken && !stored.encryptedRefreshToken) {
    return {
      success: false,
      message: "Gagal: Google Drive belum terhubung. Silakan lakukan otentikasi Google Drive OAuth terlebih dahulu.",
    };
  }

  // Pastikan folder structure ada
  const folderCheck = await ensureDriveFolderStructure();
  if (!folderCheck.success || !folderCheck.subfolders?.Memory) {
    return {
      success: false,
      message: `Sinkronisasi tertahan: ${folderCheck.message}`,
    };
  }

  let accessToken = "";
  try {
    if (stored.encryptedAccessToken) {
      accessToken = decryptSecret(stored.encryptedAccessToken);
    }
  } catch {
    return { success: false, message: "Token akses tidak dapat didekripsi." };
  }

  if (accessToken && folderCheck.subfolders.Memory) {
    try {
      const memory = await getProjectMemory();
      const content = JSON.stringify(memory, null, 2);
      const memoryFolderId = folderCheck.subfolders.Memory;

      // Cari apakah file project-memory.json sudah ada di subfolder Memory
      const fileSearch = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `name = 'project-memory.json' and '${memoryFolderId}' in parents and trashed = false`
        )}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      let fileId = "";
      if (fileSearch.ok) {
        const fileData = (await fileSearch.json()) as { files: Array<{ id: string }> };
        fileId = fileData.files[0]?.id || "";
      }

      if (fileId) {
        // Update existing file content
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: content,
        });
      } else {
        // Create new file via multipart or metadata + media
        const meta = {
          name: "project-memory.json",
          parents: [memoryFolderId],
          mimeType: "application/json",
        };
        const boundary = "-------314159265358979323846";
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const multipartBody =
          delimiter +
          "Content-Type: application/json\r\n\r\n" +
          JSON.stringify(meta) +
          delimiter +
          "Content-Type: application/json\r\n\r\n" +
          content +
          closeDelim;

        await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        });
      }

      const syncTime = new Date().toISOString();
      stored.lastSyncedAt = syncTime;
      stored.syncMessage = "Project Memory berhasil disinkronkan ke folder 'DEVFANTA MELATI - AI Agent/Memory'.";
      saveStoredTokens(stored);

      return {
        success: true,
        message: stored.syncMessage,
        lastSyncedAt: syncTime,
      };
    } catch (err) {
      return {
        success: false,
        message: `Gagal mengunggah ke Google Drive: ${err instanceof Error ? redactSensitiveData(err.message) : "Network error"}`,
      };
    }
  }

  return {
    success: false,
    message: "Google Drive OAuth belum aktif. Kredensial server belum terkonfigurasi.",
  };
}
