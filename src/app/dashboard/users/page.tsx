import { Page } from "@/components/dashboard/ui";
import { Alert, EmptyState, Button, Select, Badge } from "@/components/ui";
import { membershipLabels } from "@/lib/shell";
import { USER_MESSAGES } from "@/lib/errors";
import { requireCapability, APP_ROLES } from "@/lib/auth";
import { hasCapability } from "@/lib/capabilities";
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
  "super-admin-only": "Perubahan membership Super Admin hanya dapat dilakukan Super Admin aktif sekolah ini.",
  "concurrent-change": "Akses berubah saat diproses. Muat ulang dan periksa kembali sebelum mencoba.",
  "last-super-admin": "Super Admin aktif terakhir tidak dapat dinonaktifkan atau diturunkan rolenya.",
};

export default async function UsersPage({ searchParams }: Props) {
  const context = await requireCapability("users.read");
  const params = await searchParams;
  const canManageSuperAdmins = hasCapability(context, "users.manage_super_admin");
  const assignableRoles = APP_ROLES.filter((role) => role !== "super_admin" || canManageSuperAdmins);
  const { data: memberships, error: membershipsError } = await context.supabase
    .from("school_memberships")
    .select("id, user_id, role, status, created_at")
    .eq("school_id", context.membership.school_id)
    .order("created_at", { ascending: false });
  if (membershipsError) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  const userIds = (memberships ?? []).map((item) => item.user_id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await context.supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  let emailMap = new Map<string, string>();
  let emailLookupFailed = false;
  try {
    emailMap = await getAuthEmails(userIds);
  } catch {
    emailLookupFailed = true;
  }

  return (
    <Page title="Kelola pengguna" description="Setujui akun dan tetapkan peran sesuai kebutuhan sekolah.">
        {emailLookupFailed && <Alert tone="warning">Email pengguna belum dapat dimuat. Silakan coba kembali beberapa saat lagi.</Alert>}
        {params.success && <Alert tone="success">Perubahan membership berhasil disimpan.</Alert>}
        {params.error && <Alert tone="destructive">{errorMessages[params.error] ?? "Perubahan belum berhasil."}</Alert>}
        <div className="users-list overflow-hidden rounded-xl border border-border bg-surface">
          <div className="hidden grid-cols-[1.2fr_1.3fr_1fr_1fr_2fr] gap-4 border-b border-border px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted xl:grid"><span>Nama</span><span>Email</span><span>Status</span><span>Role</span><span>Aksi</span></div>
          {(memberships ?? []).length === 0 ? <EmptyState title="Belum ada pengguna terdaftar" description="Akun yang bergabung dengan sekolah akan ditampilkan di sini." /> : <div className="divide-y divide-border">
            {(memberships ?? []).map((membership) => {
              const isSelf = membership.user_id === context.user.id;
              const canEdit = hasCapability(context, "users.manage") && (!isSelf || (canManageSuperAdmins && membership.role === "super_admin"))
                && (membership.role !== "super_admin" || canManageSuperAdmins);
              const canApprove = canEdit && ["pending", "rejected", "suspended"].includes(membership.status);
              const canReject = canEdit && membership.status === "pending";
              const canSuspend = canEdit && membership.status === "active";
              const canChangeRole = canEdit && membership.status === "active";
              return <form action={updateMembership} key={membership.id} className="grid gap-4 px-5 py-5 xl:grid-cols-[1.2fr_1.3fr_1fr_1fr_2fr] xl:items-center"><input type="hidden" name="membership_id" value={membership.id} /><div><p className="font-semibold text-foreground">{profileMap.get(membership.user_id) ?? "Nama belum tersedia"}</p><p className="mt-1 break-all text-xs text-muted xl:hidden">{emailMap.get(membership.user_id) ?? (emailLookupFailed ? "Email belum tersedia" : "Tidak tersedia")}</p>{isSelf && <p className="mt-1 text-xs font-semibold text-foreground">Akun Anda</p>}</div><p className="hidden break-all text-sm text-muted xl:block">{emailMap.get(membership.user_id) ?? (emailLookupFailed ? "Email belum tersedia" : "Tidak tersedia")}</p><p className="text-sm capitalize text-muted">Status: <Badge tone={membership.status === "active" ? "success" : membership.status === "pending" ? "warning" : "destructive"}>{membershipLabels[membership.status] ?? "Belum tersedia"}</Badge></p>{!canEdit ? <span className="text-sm capitalize">{membership.role?.replaceAll("_", " ") ?? (membership.status === "active" ? "Akses Dasar" : "Belum ada role")}</span> : <Select name="role" defaultValue={membership.role ?? ""} aria-label={`Role ${profileMap.get(membership.user_id) ?? "pengguna"}`} className="capitalize"><option value="">{membership.status === "active" ? "Akses Dasar" : "Belum ada role"}</option>{assignableRoles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</Select>}<div className="flex flex-wrap gap-2">{(canApprove || canChangeRole) && <Button name="status" value="active" type="submit" >{canChangeRole ? "Simpan role" : "Aktifkan"}</Button>}{canReject && <Button name="status" value="rejected" type="submit" variant="destructive">Tolak</Button>}{canSuspend && <Button name="status" value="suspended" type="submit" variant="outline">Suspend</Button>}{!canEdit && <span className="text-xs text-muted">{membership.role === "super_admin" && !canManageSuperAdmins ? "Dikelola Super Admin sekolah." : "Aksi akun sendiri dinonaktifkan."}</span>}{canEdit && !canApprove && !canReject && !canSuspend && !canChangeRole && <span className="text-xs text-muted">Tidak ada aksi tersedia.</span>}</div></form>;
            })}
          </div>}
        </div>
    </Page>
  );
}
