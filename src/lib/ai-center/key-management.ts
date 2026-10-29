import "server-only";
import { Buffer } from "node:buffer";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { redactSensitiveData } from "@/lib/ai-center/tools";

export type ApiProviderKeyType = "gemini" | "openai" | "anthropic" | "custom";

export type ManagedApiKey = {
  id: string;
  providerType: ApiProviderKeyType;
  label: string;
  ownerEmail: string;
  model: string;
  maskedSecret: string;
  encryptedSecret: string;
  isActive: boolean;
  lastTestedAt?: string;
  testStatus?: "success" | "failed" | "untested";
  testMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyHistoryEvent = {
  id: string;
  keyId: string;
  provider: string;
  action: "added" | "updated" | "activated" | "deactivated" | "tested" | "deleted";
  actor: string;
  timestamp: string;
  details: string;
};

export type KeyStoreData = {
  keys: ManagedApiKey[];
  history: ApiKeyHistoryEvent[];
  updatedAt: string;
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getSafeCwd(): string {
  return typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";
}

const KEYS_STORAGE_DIR = path.resolve(getSafeCwd(), ".ai-memory");
const KEYS_STORAGE_FILE = path.join(KEYS_STORAGE_DIR, "managed-keys.json");

function getEncryptionKey(): Buffer {
  const seed =
    process.env.AI_SECRET_ENCRYPTION_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "devfanta-melati-ai-center-secret-seed-2026";
  return crypto.createHash("sha256").update(seed).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Format ciphertext tidak valid.");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

export function maskApiKey(secret: string): string {
  if (!secret || typeof secret !== "string") return "••••••••";
  const clean = secret.trim();
  if (clean.length <= 8) return "••••••••";
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

export function loadKeyStore(): KeyStoreData {
  try {
    if (fs.existsSync(KEYS_STORAGE_FILE)) {
      const raw = fs.readFileSync(KEYS_STORAGE_FILE, "utf8");
      return JSON.parse(raw) as KeyStoreData;
    }
  } catch {
    // Fallback jika belum diinisialisasi
  }
  return {
    keys: [],
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

function saveKeyStore(data: KeyStoreData): boolean {
  try {
    if (!fs.existsSync(KEYS_STORAGE_DIR)) {
      fs.mkdirSync(KEYS_STORAGE_DIR, { recursive: true });
    }
    const tempFile = path.join(
      KEYS_STORAGE_DIR,
      `temp-keys-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, KEYS_STORAGE_FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mengambil daftar kunci API yang aman ditampilkan di UI (hanya maskedSecret, tanpa plaintext).
 */
export async function getManagedApiKeys(): Promise<Omit<ManagedApiKey, "encryptedSecret">[]> {
  return getManagedApiKeysSync();
}

export function getManagedApiKeysSync(): Omit<ManagedApiKey, "encryptedSecret">[] {
  const store = loadKeyStore();
  return store.keys.map((k) => ({
    id: k.id,
    providerType: k.providerType,
    label: k.label,
    ownerEmail: k.ownerEmail,
    model: k.model,
    maskedSecret: k.maskedSecret,
    isActive: k.isActive,
    lastTestedAt: k.lastTestedAt,
    testStatus: k.testStatus,
    testMessage: k.testMessage,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  }));
}

/**
 * Menambahkan kunci API baru dengan enkripsi server-side.
 */
export async function addManagedApiKey(params: {
  providerType: ApiProviderKeyType;
  label: string;
  ownerEmail: string;
  model: string;
  secret: string;
  actor?: string;
}): Promise<{ success: boolean; message: string; keyId?: string }> {
  const store = loadKeyStore();
  const rawSecret = params.secret.trim();

  if (!rawSecret || rawSecret.length < 8) {
    return { success: false, message: "Secret API key terlalu pendek atau kosong (minimal 8 karakter)." };
  }

  const id = `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const encrypted = encryptSecret(rawSecret);
  const masked = maskApiKey(rawSecret);

  const newKey: ManagedApiKey = {
    id,
    providerType: params.providerType,
    label: params.label.trim() || `${params.providerType.toUpperCase()} Key`,
    ownerEmail: params.ownerEmail.trim() || "alwisginting@gmail.com",
    model: params.model.trim(),
    maskedSecret: masked,
    encryptedSecret: encrypted,
    isActive: true,
    testStatus: "untested",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.keys.unshift(newKey);

  // Catat riwayat audit
  const historyEvent: ApiKeyHistoryEvent = {
    id: `kh-${Date.now()}`,
    keyId: id,
    provider: params.providerType,
    action: "added",
    actor: params.actor || "Super Admin",
    timestamp: new Date().toISOString(),
    details: `Menambahkan kunci ${params.providerType} (${masked}) milik ${newKey.ownerEmail}.`,
  };
  store.history.unshift(historyEvent);
  if (store.history.length > 50) store.history.pop();

  saveKeyStore(store);
  return { success: true, message: `Kunci ${params.providerType} berhasil disimpan secara terenkripsi.`, keyId: id };
}

/**
 * Mengubah status aktif/nonaktif kunci API.
 */
export async function toggleApiKeyStatus(
  keyId: string,
  isActive: boolean,
  actor = "Super Admin"
): Promise<{ success: boolean; message: string }> {
  const store = loadKeyStore();
  const key = store.keys.find((k) => k.id === keyId);
  if (!key) return { success: false, message: "Kunci tidak ditemukan." };

  key.isActive = isActive;
  key.updatedAt = new Date().toISOString();

  store.history.unshift({
    id: `kh-${Date.now()}`,
    keyId,
    provider: key.providerType,
    action: isActive ? "activated" : "deactivated",
    actor,
    timestamp: new Date().toISOString(),
    details: `Kunci ${key.providerType} (${key.maskedSecret}) di-${isActive ? "aktifkan" : "nonaktifkan"}.`,
  });

  saveKeyStore(store);
  return { success: true, message: `Status kunci berhasil diubah menjadi ${isActive ? "Aktif" : "Nonaktif"}.` };
}

/**
 * Menguji format dan validitas kunci API tanpa membocorkan secret.
 */
export async function testApiKey(
  keyId: string,
  actor = "Super Admin"
): Promise<{ success: boolean; message: string }> {
  const store = loadKeyStore();
  const key = store.keys.find((k) => k.id === keyId);
  if (!key) return { success: false, message: "Kunci tidak ditemukan." };

  let plaintext = "";
  try {
    plaintext = decryptSecret(key.encryptedSecret);
  } catch {
    key.testStatus = "failed";
    key.testMessage = "Gagal mendekripsi kunci server-side.";
    key.lastTestedAt = new Date().toISOString();
    saveKeyStore(store);
    return { success: false, message: "Gagal mendekripsi kunci." };
  }

  // Verifikasi pola format kredensial resmi
  let validFormat = false;
  let validationNote = "";

  if (key.providerType === "gemini") {
    validFormat = /^AIzaSy[a-zA-Z0-9_-]{33}$/.test(plaintext);
    validationNote = validFormat
      ? "Format API Key Google Gemini (AIzaSy...) terverifikasi sah."
      : "Format tidak sesuai standar Google AI Studio (wajib diawali AIzaSy, 39 karakter).";
  } else if (key.providerType === "openai") {
    validFormat = /^sk-(?:proj-)?[a-zA-Z0-9_-]{20,}$/.test(plaintext);
    validationNote = validFormat
      ? "Format API Key OpenAI (sk-...) terverifikasi sah."
      : "Format tidak sesuai standar OpenAI Platform (wajib diawali sk-).";
  } else if (key.providerType === "anthropic") {
    validFormat = /^sk-ant-[a-zA-Z0-9_-]{20,}$/.test(plaintext);
    validationNote = validFormat
      ? "Format API Key Anthropic Claude (sk-ant-...) terverifikasi sah."
      : "Format tidak sesuai standar Anthropic Console (wajib diawali sk-ant-).";
  } else {
    validFormat = plaintext.length >= 16;
    validationNote = validFormat ? "Format kunci custom tervalidasi." : "Kunci custom terlalu pendek (minimal 16 karakter).";
  }

  key.testStatus = validFormat ? "success" : "failed";
  key.testMessage = validationNote;
  key.lastTestedAt = new Date().toISOString();
  key.updatedAt = new Date().toISOString();

  store.history.unshift({
    id: `kh-${Date.now()}`,
    keyId,
    provider: key.providerType,
    action: "tested",
    actor,
    timestamp: new Date().toISOString(),
    details: `Pengujian format kunci ${key.providerType}: ${validFormat ? "Lolos" : "Gagal"} - ${validationNote}`,
  });

  saveKeyStore(store);
  return {
    success: validFormat,
    message: redactSensitiveData(validationNote),
  };
}

/**
 * Menghapus kunci API dari penyimpanan aman.
 */
export async function deleteApiKey(
  keyId: string,
  actor = "Super Admin"
): Promise<{ success: boolean; message: string }> {
  const store = loadKeyStore();
  const idx = store.keys.findIndex((k) => k.id === keyId);
  if (idx === -1) return { success: false, message: "Kunci tidak ditemukan." };

  const [removed] = store.keys.splice(idx, 1);
  store.history.unshift({
    id: `kh-${Date.now()}`,
    keyId,
    provider: removed.providerType,
    action: "deleted",
    actor,
    timestamp: new Date().toISOString(),
    details: `Menghapus kunci ${removed.providerType} (${removed.maskedSecret}) milik ${removed.ownerEmail}.`,
  });

  saveKeyStore(store);
  return { success: true, message: `Kunci ${removed.providerType} berhasil dihapus.` };
}

/**
 * Mengambil riwayat aktivitas perubahan kunci.
 */
export async function getKeyHistory(): Promise<ApiKeyHistoryEvent[]> {
  const store = loadKeyStore();
  return store.history;
}

/**
 * Mengambil kunci aktif terenkripsi untuk provider tertentu (khusus pemanggilan server internal).
 */
export async function getActiveDecryptedKey(provider: ApiProviderKeyType): Promise<string | null> {
  const store = loadKeyStore();
  const activeKey = store.keys.find((k) => k.providerType === provider && k.isActive);
  if (!activeKey) return null;
  try {
    return decryptSecret(activeKey.encryptedSecret);
  } catch {
    return null;
  }
}
