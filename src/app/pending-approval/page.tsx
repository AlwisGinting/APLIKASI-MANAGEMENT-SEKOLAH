import { AuthCard } from "@/components/auth/auth-card";
import { Badge, Button } from "@/components/ui";
import { getAccountState } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import { redirect } from "next/navigation";

const stateCopy = {
  pending: {
    title: "Menunggu persetujuan",
    message: "Akun Anda sudah dapat digunakan, tetapi akses ke sekolah masih menunggu persetujuan administrator.",
    status: "Menunggu persetujuan",
  },
  rejected: {
    title: "Permintaan akses belum disetujui",
    message: "Permintaan akses Anda belum dapat disetujui.",
    status: "Tidak disetujui",
  },
  suspended: {
    title: "Akses dinonaktifkan",
    message: "Akses akun Anda ke sekolah ini sedang dinonaktifkan.",
    status: "Dinonaktifkan",
  },
  no_membership: {
    title: "Akses sekolah belum tersedia",
    message: "Akun Anda belum memiliki akses sekolah yang tersedia. Hubungi administrator sekolah.",
    status: "Belum tersedia",
  },
} as const;

export default async function PendingApprovalPage() {
  const { user, profile, state } = await getAccountState();
  if (state === "active" || state === "basic") redirect("/dashboard");
  const copy = stateCopy[state === "unauthenticated" ? "no_membership" : state];

  return <AuthCard eyebrow="Status akses akun" title={copy.title} description={copy.message}>
        <dl className="mt-8 divide-y divide-border rounded-lg border border-border px-5">
          <div className="flex flex-wrap justify-between gap-4 py-4 text-sm"><dt className="text-muted">Nama</dt><dd className="text-right font-semibold text-foreground">{profile?.full_name ?? "-"}</dd></div>
          <div className="flex flex-wrap justify-between gap-4 py-4 text-sm"><dt className="text-muted">Email</dt><dd className="max-w-[60%] break-all text-right font-semibold text-foreground">{user.email}</dd></div>
          <div className="flex flex-wrap justify-between gap-4 py-4 text-sm"><dt className="text-muted">Status</dt><dd><Badge tone={state === "pending" ? "warning" : "destructive"}>{copy.status}</Badge></dd></div>
        </dl>
        <form action={signOut} className="mt-8"><Button type="submit" variant="secondary" className="w-full">Keluar</Button></form>
  </AuthCard>;
}
