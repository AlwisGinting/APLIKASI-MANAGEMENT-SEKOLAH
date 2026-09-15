"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVE_SCHOOL_COOKIE, getTenantOptions } from "@/lib/auth";

export async function switchSchool(data: FormData) {
  const { tenantOptions } = await getTenantOptions();
  const selected = data.get("school_id");
  if (typeof selected !== "string" || !tenantOptions.some((item) => item.school.id === selected)) redirect("/dashboard?error=forbidden");
  (await cookies()).set(ACTIVE_SCHOOL_COOKIE, selected, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
