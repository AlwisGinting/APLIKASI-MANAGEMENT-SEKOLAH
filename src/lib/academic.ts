import "server-only";
import { cache } from "react";
import { requireCapability } from "@/lib/auth";
import { hasCapability } from "@/lib/capabilities";
import { USER_MESSAGES } from "@/lib/errors";

export const getAcademicContext = cache(async () => {
  const context = await requireCapability("dashboard.read");
  if (!hasCapability(context, "academic.read")) return { ...context, academicYear: null, semester: null };
  const { data: academicYear, error } = await context.supabase.from("academic_years").select("id, name, school_id, start_date, end_date")
    .eq("school_id", context.school.id).eq("is_active", true).maybeSingle();
  if (error) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  if (!academicYear) return { ...context, academicYear: null, semester: null };
  const { data: semester, error: termError } = await context.supabase.from("semesters").select("id, name, school_id, academic_year_id, start_date, end_date")
    .eq("school_id", context.school.id).eq("academic_year_id", academicYear.id).eq("is_active", true).maybeSingle();
  if (termError) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  return { ...context, academicYear, semester };
});
