"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  confirmVariant = "destructive",
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "secondary" | "outline" | "destructive";
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        cancelBtnRef.current?.focus();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(e) => {
        if (pending) return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          onCancel();
        }
      }}
      className="surface confirm-dialog rounded-2xl border p-6 shadow-2xl backdrop:bg-black/50"
    >
      <div className="max-w-md space-y-4">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="muted text-sm leading-relaxed">
          {message}
        </p>
        <div className="flex flex-wrap justify-end gap-3 pt-4">
          <Button
            ref={cancelBtnRef}
            variant="outline"
            type="button"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            type="button"
            loading={pending}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Memproses..." : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function ConfirmActionButton({
  triggerLabel,
  triggerVariant = "outline",
  title,
  message,
  confirmLabel,
  confirmVariant = "destructive",
  action,
  className,
}: {
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "secondary" | "outline" | "destructive";
  action: () => Promise<void> | void;
  className?: string;
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
      <Button
        ref={triggerRef}
        type="button"
        variant={triggerVariant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <ConfirmDialog
        isOpen={open}
        title={title}
        message={message}
        confirmLabel={confirmLabel ?? triggerLabel}
        confirmVariant={confirmVariant}
        onCancel={handleClose}
        onConfirm={async () => {
          await action();
          handleClose();
        }}
      />
    </>
  );
}
