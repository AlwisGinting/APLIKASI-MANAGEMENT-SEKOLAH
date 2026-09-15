import { hasCapability } from "@/lib/capabilities";
import { Page, Card } from "@/components/dashboard/ui";
import { feedbackTableMissing, feedbackUnavailable } from "@/lib/feedback";
import { USER_MESSAGES } from "@/lib/errors";
import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { updateFeedbackStatus } from "./actions";

const typeLabels: Record<string, string> = { suggestion: "Saran", bug: "Bug / Error", complaint: "Keluhan", other: "Lainnya" };
const statusLabels: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };
type Props = { searchParams: Promise<{ status?: string; type?: string; error?: string; success?: string }> };

export default async function FeedbackPage({ searchParams }: Props) {
  const context = await requireCapability("feedback.read_own"); const params = await searchParams;
  const isAdmin = hasCapability(context, "feedback.manage");
  let query = context.supabase.from("feedbacks").select("id, user_id, type, title, message, current_path, status, created_at").eq("school_id", context.membership.school_id).order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("user_id", context.user.id);
  if (params.status && Object.keys(statusLabels).includes(params.status)) query = query.eq("status", params.status);
  if (params.type && Object.keys(typeLabels).includes(params.type)) query = query.eq("type", params.type);
  const { data: feedbacks, error: feedbacksError } = await query;
  if (feedbackTableMissing(feedbacksError)) return <Page title="Feedback"><Card><p role="status">{feedbackUnavailable}</p></Card></Page>;
  if (feedbacksError) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  const userIds = [...new Set((feedbacks ?? []).map((feedback) => feedback.user_id))];
  const { data: profiles, error: profilesError } = userIds.length ? await context.supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [], error: null };
  if (profilesError) throw new Error(USER_MESSAGES.SERVICE_UNAVAILABLE);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  return <main className="min-h-0 bg-[#f6f8f5] px-6 py-10 sm:px-10"><div className="mx-auto max-w-6xl"><Link href="/dashboard" className="text-sm font-semibold text-[#2f7162]">← Kembali ke dashboard</Link><div className="mt-10"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e98a6a]">Masukan aplikasi</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#18312c]">Feedback</h1><p className="mt-3 text-[#60736e]">{isAdmin ? "Tinjau masukan dari pengguna sekolah." : "Lihat feedback yang pernah Anda kirim."}</p></div>{params.success && <p className="mt-6 rounded-xl bg-[#edf6f0] px-4 py-3 text-sm text-[#20584c]" role="status">Status feedback berhasil diperbarui.</p>}{params.error && <p className="mt-6 rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#b85e43]" role="alert">Tidak dapat memperbarui feedback.</p>}<form className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-[#dce7e1] bg-white p-4"><select name="status" defaultValue={params.status ?? ""} className="rounded-xl border border-[#cbdcd3] px-3 py-2 text-sm"><option value="">Semua status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select name="type" defaultValue={params.type ?? ""} className="rounded-xl border border-[#cbdcd3] px-3 py-2 text-sm"><option value="">Semua jenis</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-xl bg-[#20584c] px-4 py-2 text-sm font-semibold text-white">Filter</button></form><section className="mt-6 space-y-4">{!feedbacks?.length ? <div className="rounded-[1.5rem] border border-[#dce7e1] bg-white p-8 text-sm text-[#60736e]">Belum ada feedback untuk filter ini.</div> : feedbacks.map((feedback) => <article key={feedback.id} className="rounded-[1.5rem] border border-[#dce7e1] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-[#60736e]">{new Date(feedback.created_at).toLocaleString("id-ID")}</p><h2 className="mt-2 text-lg font-semibold text-[#18312c]">{feedback.title}</h2><p className="mt-1 text-sm text-[#60736e]">{names.get(feedback.user_id) ?? "Pengguna"} · {typeLabels[feedback.type] ?? feedback.type}</p></div>{isAdmin ? <form action={updateFeedbackStatus} className="flex gap-2"><input type="hidden" name="id" value={feedback.id} /><select name="status" defaultValue={feedback.status} className="rounded-lg border border-[#cbdcd3] px-3 py-2 text-sm">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-lg bg-[#20584c] px-3 py-2 text-xs font-semibold text-white">Simpan</button></form> : <span className="rounded-full bg-[#edf6f0] px-3 py-1 text-xs font-semibold text-[#20584c]">{statusLabels[feedback.status] ?? feedback.status}</span>}</div><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#405c55]">{feedback.message}</p>{feedback.current_path && <p className="mt-4 text-xs text-[#60736e]">Halaman: {feedback.current_path}</p>}</article>)}</section></div></main>;
}
