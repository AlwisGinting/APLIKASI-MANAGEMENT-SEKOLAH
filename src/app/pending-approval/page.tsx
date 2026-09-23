import Link from "next/link";
import { getAccountState, SCHOOL_NAME } from "@/lib/auth";
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
  if (state === "active") redirect("/dashboard");
  const copy = stateCopy[state === "unauthenticated" ? "no_membership" : state];

  return <main className="min-h-screen bg-[#f6f8f5] px-6 py-10 sm:px-10">
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-center">
      <Link href="/" className="mb-10 flex items-center gap-3 text-sm font-semibold tracking-wide text-[#20584c]"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#20584c] text-lg text-white">K</span>{SCHOOL_NAME}</Link>
      <div className="rounded-[2rem] border border-[#dce7e1] bg-white p-8 shadow-[0_20px_60px_rgba(32,88,76,.08)] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Status akses akun</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18312c]">{copy.title}</h1>
        <p className="mt-4 leading-7 text-[#60736e]">{copy.message}</p>
        <dl className="mt-8 divide-y divide-[#e6eee9] rounded-2xl border border-[#e6eee9] px-5">
          <div className="flex justify-between gap-4 py-4 text-sm"><dt className="text-[#60736e]">Nama</dt><dd className="text-right font-semibold text-[#18312c]">{profile?.full_name ?? "-"}</dd></div>
          <div className="flex justify-between gap-4 py-4 text-sm"><dt className="text-[#60736e]">Email</dt><dd className="max-w-[60%] break-all text-right font-semibold text-[#18312c]">{user.email}</dd></div>
          <div className="flex justify-between gap-4 py-4 text-sm"><dt className="text-[#60736e]">Status</dt><dd className="font-semibold text-[#b85e43]">{copy.status}</dd></div>
        </dl>
        <form action={signOut} className="mt-8"><button type="submit" className="secondary-button w-full">Keluar</button></form>
      </div>
    </div>
  </main>;
}
