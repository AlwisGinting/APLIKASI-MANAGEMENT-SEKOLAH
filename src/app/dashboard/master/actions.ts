"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMasterDataAccess } from "@/lib/auth";

const YEAR_PATH = "/dashboard/master/academic-years";
const SEMESTER_PATH = "/dashboard/master/semesters";
const CLASSROOM_PATH = "/dashboard/master/classrooms";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

function dateRangeIsValid(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && startDate < endDate);
}

async function canDelete(context: Awaited<ReturnType<typeof requireMasterDataAccess>>) {
  return context.membership.role === "super_admin" || context.membership.role === "kepala_sekolah";
}

export async function saveAcademicYear(formData: FormData) {
  const context = await requireMasterDataAccess();
  const id = value(formData, "id");
  const name = value(formData, "name");
  const startDate = value(formData, "start_date");
  const endDate = value(formData, "end_date");
  const isActive = formData.get("is_active") === "on";
  if (!name || !dateRangeIsValid(startDate, endDate)) redirectError(YEAR_PATH, "validation");

  if (id) {
    const { data: existing } = await context.supabase.from("academic_years").select("id").eq("id", id).eq("school_id", context.membership.school_id).maybeSingle();
    if (!existing) redirectError(YEAR_PATH, "not-found");
  }
  const payload = { school_id: context.membership.school_id, name, start_date: startDate, end_date: endDate, is_active: false, updated_at: new Date().toISOString() };
  const result = id
    ? await context.supabase.from("academic_years").update(payload).eq("id", id).eq("school_id", context.membership.school_id)
    : await context.supabase.from("academic_years").insert(payload).select("id").single();
  if (result.error) redirectError(YEAR_PATH, result.error.code === "23505" ? "duplicate" : "save");
  const savedId = id || result.data?.id;
  if (isActive && savedId) {
    const { error: activationError } = await context.supabase.rpc("activate_academic_year", { target_year_id: savedId });
    if (activationError) redirectError(YEAR_PATH, "save");
  }
  revalidatePath(YEAR_PATH); revalidatePath(SEMESTER_PATH); revalidatePath(CLASSROOM_PATH); redirect(`${YEAR_PATH}?success=saved`);
}

export async function deleteAcademicYear(formData: FormData) {
  const context = await requireMasterDataAccess();
  if (!(await canDelete(context))) redirectError(YEAR_PATH, "forbidden");
  const id = value(formData, "id");
  if (!id) redirectError(YEAR_PATH, "validation");
  const [{ count: semesterCount }, { count: classroomCount }] = await Promise.all([
    context.supabase.from("semesters").select("id", { count: "exact", head: true }).eq("academic_year_id", id).eq("school_id", context.membership.school_id),
    context.supabase.from("classrooms").select("id", { count: "exact", head: true }).eq("academic_year_id", id).eq("school_id", context.membership.school_id),
  ]);
  if ((semesterCount ?? 0) > 0 || (classroomCount ?? 0) > 0) redirectError(YEAR_PATH, "has-children");
  const { error } = await context.supabase.from("academic_years").delete().eq("id", id).eq("school_id", context.membership.school_id);
  if (error) redirectError(YEAR_PATH, "delete");
  revalidatePath(YEAR_PATH); redirect(`${YEAR_PATH}?success=deleted`);
}

export async function saveSemester(formData: FormData) {
  const context = await requireMasterDataAccess();
  const id = value(formData, "id"); const academicYearId = value(formData, "academic_year_id"); const name = value(formData, "name"); const startDate = value(formData, "start_date"); const endDate = value(formData, "end_date"); const isActive = formData.get("is_active") === "on";
  const isSuperAdmin = context.membership.role === "super_admin";
  if (!academicYearId || !name || name.length > 80 || (!isSuperAdmin && !["Ganjil", "Genap"].includes(name)) || !dateRangeIsValid(startDate, endDate)) redirectError(SEMESTER_PATH, "validation");
  const { data: year } = await context.supabase.from("academic_years").select("id, start_date, end_date").eq("id", academicYearId).eq("school_id", context.membership.school_id).maybeSingle();
  if (!year || startDate < year.start_date || endDate > year.end_date) redirectError(SEMESTER_PATH, "date-range");
  if (id) { const { data: existing } = await context.supabase.from("semesters").select("id").eq("id", id).eq("school_id", context.membership.school_id).maybeSingle(); if (!existing) redirectError(SEMESTER_PATH, "not-found"); }
  const payload = { school_id: context.membership.school_id, academic_year_id: academicYearId, name, start_date: startDate, end_date: endDate, is_active: false, updated_at: new Date().toISOString() };
  const result = id ? await context.supabase.from("semesters").update(payload).eq("id", id).eq("school_id", context.membership.school_id) : await context.supabase.from("semesters").insert(payload).select("id").single();
  if (result.error) redirectError(SEMESTER_PATH, result.error.code === "23505" ? "duplicate" : "save");
  const savedId = id || result.data?.id;
  if (isActive && savedId) {
    const { error: activationError } = await context.supabase.rpc("activate_semester", { target_semester_id: savedId });
    if (activationError) redirectError(SEMESTER_PATH, "save");
  }
  revalidatePath(SEMESTER_PATH); redirect(`${SEMESTER_PATH}?success=saved`);
}

export async function deleteSemester(formData: FormData) {
  const context = await requireMasterDataAccess();
  if (!(await canDelete(context))) redirectError(SEMESTER_PATH, "forbidden");
  const id = value(formData, "id"); if (!id) redirectError(SEMESTER_PATH, "validation");
  const { error } = await context.supabase.from("semesters").delete().eq("id", id).eq("school_id", context.membership.school_id);
  if (error) redirectError(SEMESTER_PATH, "delete");
  revalidatePath(SEMESTER_PATH); redirect(`${SEMESTER_PATH}?success=deleted`);
}

export async function saveClassroom(formData: FormData) {
  const context = await requireMasterDataAccess();
  const id = value(formData, "id"); const academicYearId = value(formData, "academic_year_id"); const name = value(formData, "name"); const code = value(formData, "code"); const level = value(formData, "level"); const description = value(formData, "description"); const capacityValue = value(formData, "capacity"); const capacity = capacityValue ? Number(capacityValue) : null; const isActive = formData.get("is_active") === "on";
  if (!academicYearId || !name || (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0))) redirectError(CLASSROOM_PATH, "validation");
  const { data: year } = await context.supabase.from("academic_years").select("id").eq("id", academicYearId).eq("school_id", context.membership.school_id).maybeSingle();
  if (!year) redirectError(CLASSROOM_PATH, "year");
  if (id) { const { data: existing } = await context.supabase.from("classrooms").select("id").eq("id", id).eq("school_id", context.membership.school_id).maybeSingle(); if (!existing) redirectError(CLASSROOM_PATH, "not-found"); }
  const payload = { school_id: context.membership.school_id, academic_year_id: academicYearId, name, code: code || null, level: level || null, description: description || null, capacity, is_active: isActive, updated_at: new Date().toISOString() };
  const result = id ? await context.supabase.from("classrooms").update(payload).eq("id", id).eq("school_id", context.membership.school_id) : await context.supabase.from("classrooms").insert(payload);
  if (result.error) redirectError(CLASSROOM_PATH, result.error.code === "23505" ? "duplicate" : "save");
  revalidatePath(CLASSROOM_PATH); redirect(`${CLASSROOM_PATH}?success=saved`);
}

export async function deleteClassroom(formData: FormData) {
  const context = await requireMasterDataAccess();
  if (!(await canDelete(context))) redirectError(CLASSROOM_PATH, "forbidden");
  const id = value(formData, "id"); if (!id) redirectError(CLASSROOM_PATH, "validation");
  const { error } = await context.supabase.from("classrooms").delete().eq("id", id).eq("school_id", context.membership.school_id);
  if (error) redirectError(CLASSROOM_PATH, "delete");
  revalidatePath(CLASSROOM_PATH); redirect(`${CLASSROOM_PATH}?success=deleted`);
}
