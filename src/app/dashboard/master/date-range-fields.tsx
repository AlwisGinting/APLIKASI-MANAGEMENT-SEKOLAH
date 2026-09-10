"use client";

import { useEffect, useState } from "react";
import { DatePickerField } from "./date-picker-field";

type Props = {
  startName: string;
  endName: string;
  startValue?: string;
  endValue?: string;
  min?: string;
  max?: string;
  yearRanges?: Array<{ id: string; start_date: string; end_date: string }>;
  yearSelectName?: string;
};

export function DateRangeFields({ startName, endName, startValue = "", endValue = "", min, max, yearRanges, yearSelectName }: Props) {
  const [startDate, setStartDate] = useState(startValue);
  const [range, setRange] = useState({ min, max });
  useEffect(() => {
    if (!yearRanges || !yearSelectName) return;
    const select = document.querySelector<HTMLSelectElement>(`select[name="${yearSelectName}"]`);
    if (!select) return;
    const syncRange = () => {
      const selected = yearRanges.find((year) => year.id === select.value);
      setRange({ min: selected?.start_date, max: selected?.end_date });
    };
    select.addEventListener("change", syncRange);
    syncRange();
    return () => select.removeEventListener("change", syncRange);
  }, [yearRanges, yearSelectName]);
  return <>
    <DatePickerField name={startName} label="Tanggal mulai" defaultValue={startValue} min={range.min} max={range.max} required onValueChange={setStartDate} />
    <DatePickerField name={endName} label="Tanggal selesai" defaultValue={endValue} min={startDate || range.min} max={range.max} required />
  </>;
}