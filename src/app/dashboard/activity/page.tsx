import { requireCapability } from "@/lib/auth";
import { hasCapability } from "@/lib/capabilities";
import { getTenantAudit } from "@/lib/audit";
import { auditActionLabel, auditEntityLabel, auditMetadataLines } from "@/lib/audit-format";
import { getOwnFeedback } from "@/lib/school";
import { dateLabel } from "@/lib/shell";
import { Page, Card } from "@/components/dashboard/ui";
export default async function ActivityPage() {
  const context = await requireCapability("activity.read");
  const { user, profile, membership } = context;
  const audit = hasCapability(context, "audit.read") ? await getTenantAudit() : null;
  const feedback = await getOwnFeedback();
  const events = [
    { id: "created", label: "Akun dibuat", at: user.created_at },
    ...(user.last_sign_in_at ? [{ id: "login", label: "Login terakhir yang tercatat", at: user.last_sign_in_at }] : []),
    ...(profile?.updated_at && profile.updated_at !== profile.created_at ? [{ id: "profile", label: "Profil terakhir diperbarui", at: profile.updated_at }] : []),
    ...(membership.approved_at ? [{ id: "membership", label: "Persetujuan membership tercatat", at: membership.approved_at }] : []),
    ...feedback.map((item) => ({ id: item.id, label: `Feedback dikirim: ${item.title}`, at: item.created_at })),
  ].filter((event) => event.at).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return <Page title="Aktivitas" description="Riwayat perubahan sekolah sesuai hak akses dan ringkasan akun Anda.">
    {audit && <Card title="Riwayat perubahan sekolah">
      {!audit.available ? <p className="muted">Riwayat perubahan sekolah belum tersedia. Hubungi pengelola aplikasi untuk mengaktifkannya.</p> : audit.events.length ? <>
        <ol className="space-y-6">{audit.events.map((event) => <li key={event.id} className="border-l-2 pl-5">
          <p className="font-medium">{auditActionLabel(event.action)}</p>
          <p className="muted mt-1 break-words text-sm">Oleh {event.actorLabel}</p>
          <time className="muted mt-1 block text-sm" dateTime={event.created_at}>{dateLabel(event.created_at)}</time>
          <p className="mt-2 break-all text-sm">{auditEntityLabel(event.entity_type)}{event.entity_id ? ` · ${event.entity_id}` : ""}</p>
          {auditMetadataLines(event.metadata).map((line) => <p key={line} className="muted mt-1 text-sm">{line}</p>)}
        </li>)}</ol>
        <p className="muted mt-6 text-sm">Menampilkan maksimal 50 perubahan terbaru pada sekolah aktif. Nama pelaku mengikuti profil yang masih tersedia saat ini.</p>
      </> : <p className="muted">Belum ada perubahan yang tercatat untuk sekolah ini.</p>}
    </Card>}
    <Card title="Ringkasan akun Anda">{events.length ? <ol className="space-y-5">{events.map((event) => <li key={event.id} className="border-l-2 pl-5"><p className="break-words font-medium">{event.label}</p><time className="muted mt-1 block text-sm" dateTime={event.at}>{dateLabel(event.at)}</time></li>)}</ol> : <p className="muted">Belum ada aktivitas yang tersedia.</p>}</Card>
    <p className="muted text-sm">Ringkasan akun berasal dari data saat ini dan maksimal 20 feedback terbaru milik Anda. Ini bukan riwayat lengkap sesi atau perubahan kata sandi.</p>
  </Page>;
}
