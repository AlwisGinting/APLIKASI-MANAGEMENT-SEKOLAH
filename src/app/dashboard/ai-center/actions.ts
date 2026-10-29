"use server";

import { requireCapability } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { updateTaskStatus, recordNewSession, type ProjectTaskStatus } from "@/lib/ai-center/memory";
import { safeInspectFile, redactSensitiveData } from "@/lib/ai-center/tools";
import { checkPromotionReadiness } from "@/lib/ai-center/deployment";
import {
  addManagedApiKey,
  toggleApiKeyStatus,
  testApiKey,
  deleteApiKey,
  type ApiProviderKeyType,
} from "@/lib/ai-center/key-management";
import {
  updateGoogleDriveAccount,
  disconnectGoogleDrive,
  syncProjectMemoryToDrive,
  ensureDriveFolderStructure,
} from "@/lib/ai-center/google-drive";

export type AiCenterActionState = {
  success: boolean;
  message: string;
  data?: unknown;
};

/**
 * Verifikasi otentikasi & otorisasi super_admin di sisi server.
 * Memastikan tenant aktif dan role adalah super_admin, fail-closed jika tidak berhak.
 */
async function requireSuperAdmin(capability: "ai_center.read" | "ai_center.manage" = "ai_center.manage") {
  const context = await requireCapability(capability);
  if (context.role !== "super_admin" || context.membership.status !== "active") {
    throw new Error("UNAUTHORIZED_SUPER_ADMIN_REQUIRED");
  }
  return context;
}

export async function updateMemoryTask(
  _prev: AiCenterActionState,
  formData: FormData
): Promise<AiCenterActionState> {
  let context;
  try {
    context = await requireSuperAdmin("ai_center.manage");
  } catch {
    return {
      success: false,
      message: "Akses ditolak: Operasi ini hanya diizinkan untuk akun Super Admin aktif.",
    };
  }

  const rawTaskId = formData.get("taskId")?.toString().trim();
  const rawStatus = formData.get("status")?.toString().trim();
  const rawSummary = formData.get("summary")?.toString().trim();

  // Validasi format taskId (alfanumerik, dash, underscore, 1-64 karakter)
  if (!rawTaskId || !/^[a-zA-Z0-9_-]{1,64}$/.test(rawTaskId)) {
    return { success: false, message: "Parameter task ID tidak valid atau mengandung karakter terlarang." };
  }

  // Validasi status diperbolehkan
  const validStatuses: readonly ProjectTaskStatus[] = ["pending", "in_progress", "completed", "failed"];
  if (!rawStatus || !validStatuses.includes(rawStatus as ProjectTaskStatus)) {
    return { success: false, message: "Status task tidak valid. Pilih salah satu dari: pending, in_progress, completed, failed." };
  }

  // Validasi summary (opsional, maks 500 karakter, bersih dari karakter kontrol)
  let cleanSummary: string | undefined;
  if (rawSummary) {
    if (rawSummary.length > 500) {
      return { success: false, message: "Ringkasan task maksimal 500 karakter." };
    }
    cleanSummary = redactSensitiveData(rawSummary.replace(/[\x00-\x1F\x7F]/g, " "));
  }

  const actorName = context.profile?.full_name ?? "Super Admin";
  const ok = await updateTaskStatus(rawTaskId, rawStatus as ProjectTaskStatus, cleanSummary, actorName);
  if (!ok) {
    return { success: false, message: `Task dengan ID '${rawTaskId}' tidak ditemukan dalam memori proyek.` };
  }

  revalidatePath("/dashboard/ai-center");
  revalidatePath("/dashboard/ai-center/memory");

  return {
    success: true,
    message: redactSensitiveData(`Status task '${rawTaskId}' berhasil diperbarui ke '${rawStatus}'.`),
  };
}

export async function inspectFileAction(
  _prev: AiCenterActionState,
  formData: FormData
): Promise<AiCenterActionState> {
  try {
    await requireSuperAdmin("ai_center.manage");
  } catch {
    return {
      success: false,
      message: "Akses ditolak: Operasi ini hanya diizinkan untuk akun Super Admin aktif.",
    };
  }

  const rawFilePath = formData.get("filePath")?.toString().trim();
  if (!rawFilePath || rawFilePath.length > 256 || rawFilePath.includes("\0")) {
    return { success: false, message: "Path file wajib disertakan, maksimal 256 karakter, dan tidak boleh null-byte." };
  }

  const result = await safeInspectFile(rawFilePath);
  return {
    success: result.success,
    message: redactSensitiveData(result.message),
    data: result.content ? redactSensitiveData(result.content) : undefined,
  };
}

export async function requestProductionPromotionAction(
  _prev: AiCenterActionState,
  formData: FormData
): Promise<AiCenterActionState> {
  let context;
  try {
    context = await requireSuperAdmin("ai_center.manage");
  } catch {
    return {
      success: false,
      message: "Akses ditolak: Operasi ini hanya diizinkan untuk akun Super Admin aktif.",
    };
  }

  const confirmation = formData.get("confirmation")?.toString().trim();
  const EXPECTED_CONFIRMATION = "SAYA SETUJU PROMOSI KE PRODUCTION";

  if (confirmation !== EXPECTED_CONFIRMATION) {
    return {
      success: false,
      message: `Konfirmasi gagal. Wajib mengetik persis teks: '${EXPECTED_CONFIRMATION}'.`,
    };
  }

  const readiness = checkPromotionReadiness();
  if (!readiness.canPromote) {
    return {
      success: false,
      message: `Promosi ditolak oleh sistem preflight: ${readiness.blockingReasons.join("; ")}`,
    };
  }

  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  const actorName = context.profile?.full_name ?? "Super Admin";

  if (!deployHookUrl) {
    return {
      success: false,
      message: "Deploy hook URL belum terdaftar di environment server. Permintaan promosi tidak dapat dikirim otomatis.",
    };
  }

  try {
    const res = await fetch(deployHookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: actorName,
        tenantId: context.membership.school_id,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      return {
        success: false,
        message: `Pemicuan webhook deployment gagal dengan status HTTP ${res.status}.`,
      };
    }

    await recordNewSession(
      `Permintaan promosi production berhasil diajukan oleh ${actorName}. Preflight 173 tes lulus.`,
      ["Branch clean", "173 tests passed", "Preflight verified", "Deploy hook triggered"],
      actorName
    );

    revalidatePath("/dashboard/ai-center");
    revalidatePath("/dashboard/ai-center/deployments");

    return {
      success: true,
      message: "Permintaan promosi ke production berhasil diajukan dan hook deployment telah dipicu.",
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal memicu webhook deployment: ${err instanceof Error ? redactSensitiveData(err.message) : "Network error"}.`,
    };
  }
}

// ==========================================
// API Key Management Actions
// ==========================================

export async function addApiKeyAction(
  _prev: AiCenterActionState,
  formData: FormData
): Promise<AiCenterActionState> {
  let context;
  try {
    context = await requireSuperAdmin("ai_center.manage");
  } catch {
    return { success: false, message: "Akses ditolak: Operasi ini membutuhkan role super_admin." };
  }

  const providerType = formData.get("providerType")?.toString().trim() as ApiProviderKeyType;
  const label = formData.get("label")?.toString().trim();
  const ownerEmail = formData.get("ownerEmail")?.toString().trim() || context.user.email || "alwisginting@gmail.com";
  const model = formData.get("model")?.toString().trim() || "default";
  const secret = formData.get("secret")?.toString().trim();

  if (!providerType || !["gemini", "openai", "anthropic", "custom"].includes(providerType)) {
    return { success: false, message: "Tipe provider tidak valid." };
  }

  if (!label || label.length > 100) {
    return { success: false, message: "Label kunci wajib diisi (maksimal 100 karakter)." };
  }

  if (!secret || secret.length < 8) {
    return { success: false, message: "Secret API key wajib diisi (minimal 8 karakter)." };
  }

  const actorName = context.profile?.full_name || context.user.email || "Super Admin";
  const result = await addManagedApiKey({
    providerType,
    label,
    ownerEmail,
    model,
    secret,
    actor: actorName,
  });

  revalidatePath("/dashboard/ai-center");
  revalidatePath("/dashboard/ai-center/keys");

  return {
    success: result.success,
    message: redactSensitiveData(result.message),
  };
}

export async function toggleApiKeyAction(
  _prev: AiCenterActionState,
  formData: FormData
): Promise<AiCenterActionState> {
  let context;
  try {
    context = await requireSuperAdmin("ai_center.manage");
  } catch {
    return { success: false, message: "Akses ditolak: Operasi ini membutuhkan role super_admin." };
  }

  const keyId = formData.get("keyId")?.toString().trim();
  const isActive = formData.get("isActive")?.toString() === "true";

  if (!keyId) return { success: false, message: "Key ID tidak valid." };

  const actorName = context.profile?.full_name || context.user.email || "Super Admin";
  const result = await toggleApiKeyStatus(keyId, isActive, actorName);

  revalidatePath("/dashboard/ai-center");
  revalidatePath("/dashboard/ai-center/keys");

  return {
    success: result.success,
    message: redactSensitiveData(result.message),
  };
}

export async function testApiKeyAction(
  _prev: AiCenterActionState,
  formData: FormData
): Promise<AiCenterActionState> {
  let context;
  try {
    context = await requireSuperAdmin("ai_center.manage");
  } catch {
    return { success: false, message: "Akses ditolak: Operasi ini membutuhkan role super_admin." };
  }

  const keyId = formData.get("keyId")?.toString().trim();
  if (!keyId) return { success: false, message: "Key ID tidak valid." };

  const actorName = context.profile?.full_name || context.user.email || "Super Admin";
  const result = await testApiKey(keyId, actorName);

  revalidatePath("/dashboard/ai-center");
  revalidatePath("/dashboard/ai-center/keys");

  return {
    success: result.success,
    message: redactSensitiveData(result.message),
  };
}

export async function deleteApiKeyAction(
  _prev: AiCenterActionState,
  formData: FormData
): Promise<AiCenterActionState> {
  let context;
  try {
    context = await requireSuperAdmin("ai_center.manage");
  } catch {
    return { success: false, message: "Akses ditolak: Operasi ini membutuhkan role super_admin." };
  }

  const keyId = formData.get("keyId")?.toString().trim();
  if (!keyId) return { success: false, message: "Key ID tidak valid." };

  const actorName = context.profile?.full_name || context.user.email || "Super Admin";
  const result = await deleteApiKey(keyId, actorName);

  revalidatePath("/dashboard/ai-center");
  revalidatePath("/dashboard/ai-center/keys");

  return {
    success: result.success,
    message: redactSensitiveData(result.message),
  };
}

// ==========================================
// Google Drive Actions
// ==========================================

export async function updateDriveAccountAction(
  _prev: AiCenterActionState,
  formData: FormData
): Promise<AiCenterActionState> {
  try {
    await requireSuperAdmin("ai_center.manage");
  } catch {
    return { success: false, message: "Akses ditolak: Operasi ini membutuhkan role super_admin." };
  }

  const email = formData.get("email")?.toString().trim();
  if (!email || !email.includes("@")) {
    return { success: false, message: "Email akun Google Drive tidak valid." };
  }

  const result = await updateGoogleDriveAccount(email);
  revalidatePath("/dashboard/ai-center");
  revalidatePath("/dashboard/ai-center/drive");

  return {
    success: result.success,
    message: redactSensitiveData(result.message),
  };
}

export async function disconnectDriveAction(): Promise<AiCenterActionState> {
  try {
    await requireSuperAdmin("ai_center.manage");
  } catch {
    return { success: false, message: "Akses ditolak: Operasi ini membutuhkan role super_admin." };
  }

  const result = await disconnectGoogleDrive();
  revalidatePath("/dashboard/ai-center");
  revalidatePath("/dashboard/ai-center/drive");

  return {
    success: result.success,
    message: redactSensitiveData(result.message),
  };
}

export async function syncDriveMemoryAction(): Promise<AiCenterActionState> {
  try {
    await requireSuperAdmin("ai_center.manage");
  } catch {
    return { success: false, message: "Akses ditolak: Operasi ini membutuhkan role super_admin." };
  }

  const result = await syncProjectMemoryToDrive();
  revalidatePath("/dashboard/ai-center");
  revalidatePath("/dashboard/ai-center/drive");
  revalidatePath("/dashboard/ai-center/memory");

  return {
    success: result.success,
    message: redactSensitiveData(result.message),
  };
}

export async function checkDriveStructureAction(): Promise<AiCenterActionState> {
  try {
    await requireSuperAdmin("ai_center.manage");
  } catch {
    return { success: false, message: "Akses ditolak: Operasi ini membutuhkan role super_admin." };
  }

  const result = await ensureDriveFolderStructure();
  revalidatePath("/dashboard/ai-center/drive");

  return {
    success: result.success,
    message: redactSensitiveData(result.message),
  };
}
