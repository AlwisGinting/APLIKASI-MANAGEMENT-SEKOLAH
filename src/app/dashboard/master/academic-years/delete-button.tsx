"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteAcademicYearButton({
  id,
  name,
  action,
}: {
  id: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClose = () => {
    setOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[#f0c8ba] px-3 py-2 text-xs font-semibold text-[#b85e43] hover:bg-[#fff1ed]"
      >
        Hapus
      </button>
      <ConfirmDialog
        isOpen={open}
        title="Hapus Tahun Ajaran"
        message={`Apakah Anda yakin ingin menghapus tahun ajaran "${name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        confirmVariant="destructive"
        onCancel={handleClose}
        onConfirm={async () => {
          const data = new FormData();
          data.set("id", id);
          await action(data);
          handleClose();
        }}
      />
    </>
  );
}
