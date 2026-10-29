import "server-only";
import { getManagedApiKeysSync } from "@/lib/ai-center/key-management";

export type AiProviderType = "gemini" | "openai" | "anthropic" | "custom";

export type AiModelConfig = {
  id: string;
  name: string;
  contextTokens: number;
  description: string;
};

export type ProviderConnectionStatus = "connected" | "not_connected";

export type ProviderConnection = {
  id: string;
  label: string;
  providerType: AiProviderType;
  model: string;
  accountEmailHint?: string;
  isPrimary: boolean;
  configured: boolean;
  status: ProviderConnectionStatus;
  statusLabel: string;
  authMethod: string;
  envKeyName: string;
  disclaimer: string;
};

export type ProviderConnectionOptions = {
  label?: string;
  accountEmailHint?: string;
  isPrimary?: boolean;
};

export type AiCompletionResult = {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
};

export type AiProviderAdapter = {
  type: AiProviderType;
  name: string;
  envVar: string;
  models: readonly AiModelConfig[];
  isConfigured: () => boolean;
  getConnection: (options?: ProviderConnectionOptions) => ProviderConnection;
  generateCompletion?: (prompt: string, modelId?: string) => Promise<AiCompletionResult>;
};

export const GEMINI_MODELS: readonly AiModelConfig[] = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextTokens: 1048576, description: "Cepat, efisien, cocok untuk indexing context & parsing dokumen" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextTokens: 2097152, description: "Penalaran tinggi, reasoning mendalam dan perancangan arsitektur" },
] as const;

export const OPENAI_MODELS: readonly AiModelConfig[] = [
  { id: "gpt-4o", name: "GPT-4o", contextTokens: 128000, description: "Multimodal serbaguna, penalaran cepat dan coding" },
  { id: "gpt-4o-mini", name: "GPT-4o mini", contextTokens: 128000, description: "Ringan, latensi sangat rendah untuk task operasional cepat" },
] as const;

export const ANTHROPIC_MODELS: readonly AiModelConfig[] = [
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", contextTokens: 200000, description: "Kemampuan coding dan arsitektur tingkat lanjut dengan hybrid thinking" },
] as const;

function findActiveManagedKey(type: AiProviderType) {
  try {
    const keys = getManagedApiKeysSync();
    return keys.find((k) => k.providerType === type && k.isActive);
  } catch {
    return undefined;
  }
}

export const geminiAdapter: AiProviderAdapter = {
  type: "gemini",
  name: "Google Gemini API",
  envVar: "GEMINI_API_KEY",
  models: GEMINI_MODELS,
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || findActiveManagedKey("gemini")),
  getConnection: (options?: ProviderConnectionOptions) => {
    const managedKey = findActiveManagedKey("gemini");
    const envConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY);
    const configured = Boolean(managedKey || envConfigured);

    return {
      id: "conn-gemini-primary",
      label: managedKey?.label ?? options?.label ?? "Koneksi Utama Gemini",
      providerType: "gemini",
      model: managedKey?.model ?? "gemini-2.5-flash",
      accountEmailHint: managedKey?.ownerEmail ?? options?.accountEmailHint,
      isPrimary: options?.isPrimary ?? true,
      configured,
      status: configured ? "connected" : "not_connected",
      statusLabel: managedKey
        ? `Terkoneksi via Key Terenkripsi (${managedKey.maskedSecret})`
        : envConfigured
        ? "Terkoneksi (Server Environment Variable)"
        : "Belum Terhubung (API Key Tidak Ditemukan)",
      authMethod: managedKey
        ? `Managed AES-256 Key (${managedKey.ownerEmail})`
        : "Server Environment Variable (GEMINI_API_KEY)",
      envKeyName: "GEMINI_API_KEY",
      disclaimer: "Login email Google/Gmail pengguna tidak memberikan kuota API otomatis. Akses API memerlukan API Key resmi dari Google AI Studio atau Google Cloud Vertex AI.",
    };
  },
  generateCompletion: async () => {
    if (!geminiAdapter.isConfigured()) {
      throw new Error("Provider Google Gemini belum terhubung: Daftarkan GEMINI_API_KEY di environment server atau Menu API Keys.");
    }
    throw new Error("Eksekusi inference langsung dinonaktifkan dalam mode sandbox development.");
  },
};

export const openaiAdapter: AiProviderAdapter = {
  type: "openai",
  name: "OpenAI / ChatGPT API",
  envVar: "OPENAI_API_KEY",
  models: OPENAI_MODELS,
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY || findActiveManagedKey("openai")),
  getConnection: (options?: ProviderConnectionOptions) => {
    const managedKey = findActiveManagedKey("openai");
    const envConfigured = Boolean(process.env.OPENAI_API_KEY);
    const configured = Boolean(managedKey || envConfigured);

    return {
      id: "conn-openai-backup",
      label: managedKey?.label ?? options?.label ?? "Koneksi OpenAI Cadangan",
      providerType: "openai",
      model: managedKey?.model ?? "gpt-4o",
      accountEmailHint: managedKey?.ownerEmail ?? options?.accountEmailHint,
      isPrimary: options?.isPrimary ?? false,
      configured,
      status: configured ? "connected" : "not_connected",
      statusLabel: managedKey
        ? `Terkoneksi via Key Terenkripsi (${managedKey.maskedSecret})`
        : envConfigured
        ? "Terkoneksi (Server Environment Variable)"
        : "Belum Terhubung (API Key Tidak Ditemukan)",
      authMethod: managedKey
        ? `Managed AES-256 Key (${managedKey.ownerEmail})`
        : "Server Environment Variable (OPENAI_API_KEY)",
      envKeyName: "OPENAI_API_KEY",
      disclaimer: "Langganan konsumen ChatGPT Plus (web UI) terpisah dari OpenAI Developer Platform. Akses API memerlukan API Key berbayar dari platform.openai.com.",
    };
  },
  generateCompletion: async () => {
    if (!openaiAdapter.isConfigured()) {
      throw new Error("Provider OpenAI belum terhubung: Daftarkan OPENAI_API_KEY di environment server atau Menu API Keys.");
    }
    throw new Error("Eksekusi inference langsung dinonaktifkan dalam mode sandbox development.");
  },
};

export const anthropicAdapter: AiProviderAdapter = {
  type: "anthropic",
  name: "Anthropic Claude API",
  envVar: "ANTHROPIC_API_KEY",
  models: ANTHROPIC_MODELS,
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY || findActiveManagedKey("anthropic")),
  getConnection: (options?: ProviderConnectionOptions) => {
    const managedKey = findActiveManagedKey("anthropic");
    const envConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
    const configured = Boolean(managedKey || envConfigured);

    return {
      id: "conn-anthropic-dev",
      label: managedKey?.label ?? options?.label ?? "Koneksi Anthropic Tambahan",
      providerType: "anthropic",
      model: managedKey?.model ?? "claude-3-7-sonnet",
      accountEmailHint: managedKey?.ownerEmail ?? options?.accountEmailHint,
      isPrimary: options?.isPrimary ?? false,
      configured,
      status: configured ? "connected" : "not_connected",
      statusLabel: managedKey
        ? `Terkoneksi via Key Terenkripsi (${managedKey.maskedSecret})`
        : envConfigured
        ? "Terkoneksi (Server Environment Variable)"
        : "Belum Terhubung (API Key Tidak Ditemukan)",
      authMethod: managedKey
        ? `Managed AES-256 Key (${managedKey.ownerEmail})`
        : "Server Environment Variable (ANTHROPIC_API_KEY)",
      envKeyName: "ANTHROPIC_API_KEY",
      disclaimer: "Akses API Claude dikelola langsung via Anthropic Console dengan sistem prepaid developer billing; terpisah dari langganan Claude Pro konsumen.",
    };
  },
  generateCompletion: async () => {
    if (!anthropicAdapter.isConfigured()) {
      throw new Error("Provider Anthropic belum terhubung: Daftarkan ANTHROPIC_API_KEY di environment server atau Menu API Keys.");
    }
    throw new Error("Eksekusi inference langsung dinonaktifkan dalam mode sandbox development.");
  },
};

// Registry adapters yang dapat diperluas tanpa memodifikasi sisa modul
const adapterRegistry: Map<AiProviderType, AiProviderAdapter> = new Map([
  ["gemini", geminiAdapter],
  ["openai", openaiAdapter],
  ["anthropic", anthropicAdapter],
]);

export function registerProviderAdapter(adapter: AiProviderAdapter): void {
  adapterRegistry.set(adapter.type, adapter);
}

export function getRegisteredAdapters(): readonly AiProviderAdapter[] {
  return Array.from(adapterRegistry.values());
}

export function getProviderAdapter(type: AiProviderType): AiProviderAdapter | undefined {
  return adapterRegistry.get(type);
}

export const AI_ADAPTERS: readonly AiProviderAdapter[] = [geminiAdapter, openaiAdapter, anthropicAdapter] as const;

export function getProviderConnections(emailHint?: string): ProviderConnection[] {
  return getRegisteredAdapters().map((adapter, idx) =>
    adapter.getConnection({
      accountEmailHint: emailHint,
      isPrimary: idx === 0,
    })
  );
}

export function getActiveProviderConnection(id?: string, emailHint?: string): ProviderConnection {
  const connections = getProviderConnections(emailHint);
  return connections.find((conn) => conn.id === id) ?? connections[0];
}
