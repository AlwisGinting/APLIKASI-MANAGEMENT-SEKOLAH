"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DateRangeFields } from "@/app/dashboard/master/date-range-fields";
import { FormSubmit } from "@/components/forms/form-feedback";
import { formSnapshot, submissionGate, warnBeforeUnload } from "@/lib/form-interaction";

type Year = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

const TRACKED_FIELDS = ["name", "start_date", "end_date", "is_active"];

export function AcademicYearForm({
  editing,
  action,
}: {
  editing?: Year;
  action: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const baseline = useRef("");
  const gate = useRef(submissionGate());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (formRef.current) {
      baseline.current = formSnapshot(formRef.current, TRACKED_FIELDS);
    }
  }, [editing]);

  useEffect(() => {
    if (!dirty) return;
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  const updateDirty = () => {
    if (formRef.current) {
      setDirty(formSnapshot(formRef.current, TRACKED_FIELDS) !== baseline.current);
    }
  };

  const confirmDiscard = () => !dirty || window.confirm("Perubahan belum disimpan. Buang perubahan?");

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        if (!gate.current.enter()) return;
        try {
          await action(formData);
        } finally {
          gate.current.leave();
        }
      }}
      onInput={updateDirty}
      onChange={updateDirty}
      className="mt-8 grid gap-4 rounded-[1.5rem] border border-[#dce7e1] bg-white p-6 sm:grid-cols-2 lg:grid-cols-5"
    >
      <input type="hidden" name="id" value={editing?.id ?? ""} />
      <label className="text-sm font-medium lg:col-span-2">
        Nama tahun ajaran
        <input
          name="name"
          defaultValue={editing?.name ?? ""}
          placeholder="2026/2027"
          required
          className="mt-2 w-full rounded-xl border border-[#cbdcd3] px-4 py-3"
        />
      </label>
      <DateRangeFields
        startName="start_date"
        endName="end_date"
        startValue={editing?.start_date ?? ""}
        endValue={editing?.end_date ?? ""}
      />
      <label className="flex items-center gap-3 self-end text-sm font-medium">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={editing?.is_active ?? false}
          className="h-4 w-4 accent-[#20584c]"
        />{" "}
        Aktif
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
        <FormSubmit pendingText="Menyimpan...">
          {editing ? "Simpan perubahan" : "Tambah tahun ajaran"}
        </FormSubmit>
        {editing && (
          <Link
            href="/dashboard/master/academic-years"
            onClick={(e) => {
              if (!confirmDiscard()) e.preventDefault();
            }}
            className="rounded-xl border border-[#cbdcd3] px-5 py-3 text-sm font-semibold text-[#20584c]"
          >
            Batal
          </Link>
        )}
      </div>
      {dirty && <p className="muted text-xs sm:col-span-2 lg:col-span-5">Ada isian yang telah diubah.</p>}
    </form>
  );
}
