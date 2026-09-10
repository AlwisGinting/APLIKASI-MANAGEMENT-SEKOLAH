"use client";

import { useRef, useState } from "react";

type Props = {
  name: string;
  label: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
};

function formatIndonesianDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

export function DatePickerField({ name, label, defaultValue = "", min, max, required = false, onValueChange }: Props) {
  const [value, setValue] = useState(defaultValue);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = nativeInputRef.current;
    if (!input) return;
    if ("showPicker" in HTMLInputElement.prototype) input.showPicker();
    else input.click();
  }

  return (
    <label className="block text-sm font-medium text-[#18312c]">
      {label}
      <span className="relative mt-2 block">
        <input type="hidden" name={name} value={value} required={required} />
        <input
          ref={nativeInputRef}
          type="date"
          value={value}
          min={min}
          max={max}
          required={required}
          aria-label={`Pilih ${label.toLowerCase()}`}
          onChange={(event) => { setValue(event.target.value); onValueChange?.(event.target.value); }}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
        <button
          type="button"
          onClick={openPicker}
          className="flex min-h-12 w-full items-center justify-between rounded-xl border border-[#cbdcd3] bg-white px-4 py-3 text-left outline-none transition hover:border-[#2f7162] focus:border-[#2f7162] focus:ring-4 focus:ring-[#dcefe5]"
          aria-label={`Buka kalender untuk ${label.toLowerCase()}`}
        >
          <span className={value ? "text-[#18312c]" : "text-[#8aa099]"}>{formatIndonesianDate(value) || "DD/MM/YYYY"}</span>
          <span aria-hidden="true" className="text-lg leading-none text-[#2f7162]">▦</span>
        </button>
      </span>
    </label>
  );
}
