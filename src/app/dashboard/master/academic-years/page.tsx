import { hasCapability } from "@/lib/capabilities";
import { USER_MESSAGES } from "@/lib/errors";
import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { deleteAcademicYear, saveAcademicYear } from "@/app/dashboard/master/actions";
import { AcademicYearForm } from "@/app/dashboard/master/academic-years/academic-year-form";
import { DeleteAcademicYearButton } from "@/app/dashboard/master/academic-years/delete-button";

type Props = { searchParams: Promise<{ error?: string; success?: string; edit?: string }> };
const messages: Record<string, string> = {
  validation: "Nama dan rentang tanggal wajib valid.",
  duplicate: "Nama tahun ajaran sudah digunakan.",
  "has-children": "Tahun ajaran yang masih memiliki semester atau kelas tidak dapat dihapus.",
  delete: "Tahun ajaran belum dapat dihapus.",
  forbidden: "Role Anda tidak dapat menghapus data ini.",
  save: "Tahun ajaran belum tersimpan.",
  "not-found": "Tahun ajaran tidak ditemukan.",
};

export default async function AcademicYearsPage({ searchParams }: Props) {
  const context = await requireCapability("academic.read");
  const params = await searchParams;
  const canManage = hasCapability(context, "academic.manage");
  const canDelete = hasCapability(context, "academic.delete");
  const { data: years, error: yearsError } = await context.supabase
    .from("academic_years")
    .select("id, name, start_date, end_date, is_active")
    .eq("school_id", context.membership.school_id)
    .order("start_date", { ascending: false });
  if (yearsError) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  const editing = canManage ? years?.find((year) => year.id === params.edit) : undefined;

  return (
    <main className="min-h-0 bg-[#f6f8f5] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/master" className="text-sm font-semibold text-[#2f7162]">
          ← Master Data
        </Link>
        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Master akademik</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#18312c]">Tahun Ajaran</h1>
          </div>
          {canManage && (
            <Link
              href="/dashboard/master/academic-years"
              className="rounded-xl bg-[#20584c] px-4 py-3 text-sm font-semibold text-white"
            >
              Tahun ajaran baru
            </Link>
          )}
        </div>
        {params.error && (
          <p className="mt-6 rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#b85e43]" role="alert">
            {messages[params.error] ?? "Terjadi kesalahan."}
          </p>
        )}
        {params.success && (
          <p className="mt-6 rounded-xl bg-[#edf6f0] px-4 py-3 text-sm text-[#20584c]" role="status">
            Perubahan berhasil disimpan.
          </p>
        )}
        {canManage && <AcademicYearForm editing={editing} action={saveAcademicYear} />}
        {!canManage && (
          <p className="mt-8 rounded-xl bg-white px-5 py-4 text-sm text-[#60736e]">
            Mode baca saja. Guru tidak dapat mengubah master data.
          </p>
        )}
        <section className="mt-8 overflow-hidden rounded-[1.5rem] border border-[#dce7e1] bg-white">
          {!years?.length ? (
            <p className="p-6 text-sm text-[#60736e]">Belum ada tahun ajaran.</p>
          ) : (
            <div className="divide-y divide-[#e6eee9]">
              {years.map((year) => (
                <div key={year.id} className="grid gap-4 px-6 py-5 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center">
                  <div>
                    <p className="font-semibold text-[#18312c]">{year.name}</p>
                    <p className="text-xs text-[#60736e]">
                      {year.start_date} sampai {year.end_date}
                    </p>
                  </div>
                  <p className="text-sm text-[#60736e]">
                    {year.start_date} - {year.end_date}
                  </p>
                  <p className="text-sm font-semibold text-[#20584c]">
                    {year.is_active ? "Aktif" : "Nonaktif"}
                  </p>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/master/academic-years?edit=${year.id}`}
                        className="rounded-lg border border-[#cbdcd3] px-3 py-2 text-xs font-semibold text-[#20584c]"
                      >
                        Edit
                      </Link>
                      {canDelete && (
                        <DeleteAcademicYearButton
                          id={year.id}
                          name={year.name}
                          action={deleteAcademicYear}
                        />
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#60736e]">Baca saja</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
