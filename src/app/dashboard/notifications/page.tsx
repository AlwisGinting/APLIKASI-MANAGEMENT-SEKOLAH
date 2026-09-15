import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { getOwnFeedback } from "@/lib/school";
import { dateLabel } from "@/lib/shell";
import { APP_CONFIG } from "@/config/app";
import { Page, Card } from "@/components/dashboard/ui";
export default async function NotificationsPage() {
  const { membership } = await requireCapability("notifications.read");
  const feedback = (await getOwnFeedback()).filter((item) => item.status === "resolved" || item.status === "closed");
  return <Page title="Pemberitahuan" description="Ringkasan status akun dan feedback Anda. Belum ada penanda dibaca atau pemberitahuan realtime."><Card title="Status akun"><p>Membership sekolah Anda aktif.</p>{membership.approved_at && <p className="muted mt-2 text-sm">Persetujuan tercatat {dateLabel(membership.approved_at)}.</p>}</Card><Card title="Pembaruan feedback">{feedback.length ? <ul className="space-y-5">{feedback.map((item) => <li key={item.id}><p className="break-words font-medium">{item.title}</p><p className="muted text-sm">{item.status === "resolved" ? "Diselesaikan" : "Ditutup"} · terakhir diperbarui {dateLabel(item.updated_at)}</p></li>)}</ul> : <p className="muted">Belum ada feedback selesai atau ditutup dalam 20 feedback terbaru Anda.</p>}<Link className="mt-5 inline-block underline" href={APP_CONFIG.routes.feedback}>Lihat semua feedback</Link></Card></Page>;
}
