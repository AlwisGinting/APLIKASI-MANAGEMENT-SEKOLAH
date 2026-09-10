import Link from "next/link";
import { requireSchoolAdmin, APP_ROLES, SCHOOL_NAME } from "@/lib/auth";
import { updateMembership } from "@/app/auth/actions";
import { getAuthEmails } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; success?: string }> };

const errorMessages: Record<string, string> = {
  input: "Data perubahan belum lengkap.",
  role: "Role aktif wajib dipilih.",
  update: "Perubahan belum berhasil. Coba lagi.",
  "not-found": "Membership tidak ditemukan di sekolah ini.",
  self: "Anda tidak dapat mengubah membership sendiri.",
  "last-super-admin": "Super Admin aktif terakhir tidak dapat dinonaktifkan atau diturunkan rolenya.",
};

export default async function UsersPage({ searchParams }: Props) {
  const context = await requireSchoolAdmin();
  const params = await searchParams;
  const { data: memberships } = await context.supabase
    .from("school_memberships")
    .select("id, user_id, role, status, created_at")
    .eq("school_id", context.membership.school_id)
    .order("created_at", { ascending: false });
  const userIds = (memberships ?? []).map((item) => item.user_id);
  const { data: profiles } = userIds.length
    ? await context.supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  let emailMap = new Map<string, string>();
  let emailLookupFailed = false;
  try {
    emailMap = await getAuthEmails(userIds);
  } catch {
    emailLookupFailed = true;
  }

  return (
    <main className="min-h-screen bg-[#f6f8f5]">
      <header className="border-b border-[#dce7e1] bg-white/75 px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 text-sm font-semibold tracking-wide text-[#20584c]"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#20584c] text-lg text-white">K</span>{SCHOOL_NAME}</Link>
          <Link href="/dashboard" className="text-sm font-semibold text-[#2f7162]">Kembali ke dashboard</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Administrasi akses</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#18312c]">Kelola pengguna</h1>
        <p className="mt-3 text-[#60736e]">Setujui akun dan tetapkan role sesuai kebutuhan sekolah.</p>
        {emailLookupFailed && <p className="mt-6 rounded-xl bg-[#fff7e8] px-4 py-3 text-sm text-[#8a641c]" role="status">Email Auth belum dapat dimuat. Pastikan secret key hanya dikonfigurasi di server.</p>}
        {params.success && <p className="mt-6 rounded-xl bg-[#edf6f0] px-4 py-3 text-sm text-[#20584c]" role="status">Perubahan membership berhasil disimpan.</p>}
        {params.error && <p className="mt-6 rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#b85e43]" role="alert">{errorMessages[params.error] ?? "Perubahan belum berhasil."}</p>}
        <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-[#dce7e1] bg-white shadow-[0_20px_60px_rgba(32,88,76,.06)]">
          <div className="hidden grid-cols-[1.2fr_1.3fr_1fr_1fr_2fr] gap-4 border-b border-[#e6eee9] px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[#60736e] md:grid"><span>Nama</span><span>Email</span><span>Status</span><span>Role</span><span>Aksi</span></div>
          {(memberships ?? []).length === 0 ? <p className="p-6 text-sm text-[#60736e]">Belum ada pengguna terdaftar.</p> : <div className="divide-y divide-[#e6eee9]">
            {(memberships ?? []).map((membership) => {
              const isSelf = membership.user_id === context.user.id;
              const canApprove = !isSelf && ["pending", "rejected", "suspended"].includes(membership.status);
              const canReject = !isSelf && membership.status === "pending";
              const canSuspend = !isSelf && membership.status === "active";
              const canChangeRole = !isSelf && membership.status === "active";
              return <form action={updateMembership} key={membership.id} className="grid gap-4 px-5 py-5 md:grid-cols-[1.2fr_1.3fr_1fr_1fr_2fr] md:items-center"><input type="hidden" name="membership_id" value={membership.id} /><div><p className="font-semibold text-[#18312c]">{profileMap.get(membership.user_id) ?? "Nama belum tersedia"}</p><p className="mt-1 break-all text-xs text-[#60736e] md:hidden">{emailMap.get(membership.user_id) ?? (emailLookupFailed ? "Email belum tersedia" : "Tidak tersedia")}</p>{isSelf && <p className="mt-1 text-xs font-semibold text-[#2f7162]">Akun Anda</p>}</div><p className="hidden break-all text-sm text-[#60736e] md:block">{emailMap.get(membership.user_id) ?? (emailLookupFailed ? "Email belum tersedia" : "Tidak tersedia")}</p><p className="text-sm capitalize text-[#60736e]">Status: <span className="font-semibold text-[#20584c]">{membership.status}</span></p><select name="role" defaultValue={membership.role ?? "guru"} disabled={isSelf} aria-label={`Role ${profileMap.get(membership.user_id) ?? "pengguna"}`} className="rounded-lg border border-[#cbdcd3] px-3 py-2 text-sm capitalize text-[#18312c] disabled:cursor-not-allowed disabled:bg-[#f1f4f2]">{APP_ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select><div className="flex flex-wrap gap-2">{(canApprove || canChangeRole) && <button name="status" value="active" type="submit" className="rounded-lg bg-[#20584c] px-3 py-2 text-xs font-semibold text-white">{canChangeRole ? "Simpan role" : "Aktifkan"}</button>}{canReject && <button name="status" value="rejected" type="submit" className="rounded-lg border border-[#f0c8ba] px-3 py-2 text-xs font-semibold text-[#b85e43]">Tolak</button>}{canSuspend && <button name="status" value="suspended" type="submit" className="rounded-lg border border-[#cbdcd3] px-3 py-2 text-xs font-semibold text-[#60736e]">Suspend</button>}{isSelf && <span className="text-xs text-[#60736e]">Aksi akun sendiri dinonaktifkan.</span>}{!isSelf && !canApprove && !canReject && !canSuspend && !canChangeRole && <span className="text-xs text-[#60736e]">Tidak ada aksi tersedia.</span>}</div></form>;
            })}
          </div>}
        </div>
      </div>
    </main>
  );
}
