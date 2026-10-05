"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { getToasts, subscribeToasts, dismissToast, toast } from "@/lib/toast";

function ToastUrlSync() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success) {
      toast.success(success === "saved" ? "Perubahan berhasil disimpan." : "Aksi berhasil diproses.");
      cleanQueryParam("success");
    } else if (error) {
      const messages: Record<string, string> = {
        validation: "Isian tidak valid. Periksa kembali data Anda.",
        duplicate: "Data dengan nama atau nilai tersebut sudah ada.",
        "has-children": "Data yang masih memiliki turunan tidak dapat dihapus.",
        forbidden: "Anda tidak memiliki hak akses untuk tindakan ini.",
        "not-found": "Data tidak ditemukan.",
        save: "Data belum berhasil disimpan. Silakan coba kembali.",
        delete: "Data belum dapat dihapus. Silakan coba kembali.",
        input: "Data yang dimasukkan belum lengkap.",
        role: "Peran aktif wajib dipilih.",
        update: "Perubahan belum berhasil. Silakan coba lagi.",
        self: "Anda tidak dapat mengubah status akun sendiri.",
        "last-super-admin": "Super Admin aktif terakhir tidak dapat dinonaktifkan.",
      };
      toast.error(messages[error] ?? "Terjadi kesalahan. Silakan coba kembali.");
      cleanQueryParam("error");
    }
  }, [searchParams]);

  return null;
}

function cleanQueryParam(param: string) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""));
    }
  } catch {
    // Ignore URL manipulation failures
  }
}

export function ToastContainer() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => []);

  return (
    <>
      <Suspense fallback={null}>
        <ToastUrlSync />
      </Suspense>
      {toasts.length > 0 && (
        <aside aria-label="Pemberitahuan aplikasi" className="toast-container" role="region">
          <div className="toast-list" aria-live="polite" aria-atomic="false">
            {toasts.map((item) => (
              <div
                key={item.id}
                role={item.tone === "destructive" ? "alert" : "status"}
                className={`toast-item ui-tone-${item.tone}`}
              >
                <div className="toast-content min-w-0 flex-1">
                  {item.title && <p className="font-semibold text-sm">{item.title}</p>}
                  <p className="text-sm break-words">{item.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(item.id)}
                  aria-label="Tutup pemberitahuan"
                  className="toast-close shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
