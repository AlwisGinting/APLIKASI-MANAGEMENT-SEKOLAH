import { requireCapability } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, Page, Info } from "@/components/dashboard/ui";
import { Alert, Button } from "@/components/ui";
import {
  getGoogleDriveState,
  getGoogleDriveOAuthUrl,
} from "@/lib/ai-center/google-drive";
import {
  updateDriveAccountAction,
  disconnectDriveAction,
  syncDriveMemoryAction,
  checkDriveStructureAction,
} from "../actions";
import Link from "next/link";

export default async function AiCenterDrivePage() {
  const context = await requireCapability("ai_center.read");
  if (context.role !== "super_admin" || context.membership.status !== "active") {
    redirect("/dashboard?error=forbidden");
  }

  const driveState = await getGoogleDriveState();
  const oauthInfo = getGoogleDriveOAuthUrl({
    loginHint: driveState.accountEmail,
  });

  return (
    <Page
      title="Google Drive Cloud Sync & Persistence"
      description="Penyimpanan persisten Project Memory dan histori kerja AI Agent di Google Drive khusus Super Admin."
    >
      {/* Tab Navigasi Internal */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-[#cbdcd3] pb-3">
        <Link
          href="/dashboard/ai-center"
          className="rounded-lg border border-[#cbdcd3] bg-white px-4 py-2 text-sm font-medium text-[#18312c] hover:bg-[#edf6f0]"
        >
          Ikhtisar
        </Link>
        <Link
          href="/dashboard/ai-center/keys"
          className="rounded-lg border border-[#cbdcd3] bg-white px-4 py-2 text-sm font-medium text-[#18312c] hover:bg-[#edf6f0]"
        >
          API Keys & Provider
        </Link>
        <Link
          href="/dashboard/ai-center/drive"
          className="rounded-lg bg-[#20584c] px-4 py-2 text-sm font-semibold text-white"
        >
          Google Drive
        </Link>
        <Link
          href="/dashboard/ai-center/memory"
          className="rounded-lg border border-[#cbdcd3] bg-white px-4 py-2 text-sm font-medium text-[#18312c] hover:bg-[#edf6f0]"
        >
          Memori & Task
        </Link>
        <Link
          href="/dashboard/ai-center/deployments"
          className="rounded-lg border border-[#cbdcd3] bg-white px-4 py-2 text-sm font-medium text-[#18312c] hover:bg-[#edf6f0]"
        >
          Deployment Center
        </Link>
      </div>

      <div className="grid gap-6">
        {/* Batasan Supabase & Drive */}
        <Alert tone="neutral" title="Prinsip Pemisahan Data: Supabase vs Google Drive">
          <p className="text-xs leading-relaxed">
            Sesuai arsitektur keamanan, <strong>data operasional sekolah tidak pernah dipindahkan ke Google Drive</strong>.
            Supabase tetap menjadi otoritas tunggal untuk data sekolah, otentikasi, dan RLS multi-tenant.
            Google Drive digunakan secara eksklusif untuk menyimpan <strong>Project Memory, riwayat task, dan sesi kerja AI Agent</strong> agar memori proyek persisten dan dapat dibaca lintas provider (Gemini, OpenAI, Claude).
          </p>
        </Alert>

        {/* Status Koneksi OAuth Google Drive */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Status Akun Google Drive">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#526b61]">Status Koneksi</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    driveState.connected
                      ? "bg-[#edf6f0] text-[#20584c]"
                      : "bg-[#fff1ed] text-[#b85e43]"
                  }`}
                >
                  {driveState.connected ? "Terkoneksi (OAuth Aktif)" : "Belum Terhubung"}
                </span>
              </div>

              <dl className="grid gap-2 border-t border-[#f2f6f4] pt-3 text-xs">
                <Info label="Akun Target" value={driveState.accountEmail} />
                <Info
                  label="OAuth Client ID"
                  value={driveState.clientIdConfigured ? "Terkonfigurasi di Server" : "Belum Diisi (GOOGLE_DRIVE_CLIENT_ID)"}
                />
                <Info label="Izin Scope" value="drive.file (Akses terbatas folder aplikasi)" />
              </dl>

              <div className="pt-2 flex flex-wrap gap-2">
                {oauthInfo.configured ? (
                  <a
                    href={oauthInfo.url}
                    className="inline-flex items-center rounded-lg bg-[#20584c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#18312c]"
                  >
                    {driveState.connected ? "Hubungkan Ulang / Ganti Akun" : "Otorisasi Akun Google Drive"}
                  </a>
                ) : (
                  <span className="text-xs text-[#b85e43]">
                    Koneksi OAuth memerlukan <code>GOOGLE_DRIVE_CLIENT_ID</code> di server.
                  </span>
                )}

                {driveState.connected && (
                  <form
                    action={async () => {
                      "use server";
                      await disconnectDriveAction();
                    }}
                  >
                    <Button type="submit" variant="secondary">
                      Putus Koneksi
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </Card>

          <Card title="Ganti Akun Target Google Drive">
            <p className="muted mb-3 text-xs">
              Akun awal default adalah <code>alwisginting@gmail.com</code>. Anda dapat mengganti email akun Google Drive yang dituju di bawah ini:
            </p>

            <form
              action={async (formData: FormData) => {
                "use server";
                await updateDriveAccountAction({ success: true, message: "" }, formData);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-[#18312c] mb-1">
                  Email Akun Google
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={driveState.accountEmail}
                  className="w-full rounded-lg border border-[#cbdcd3] bg-white px-3 py-2 text-sm text-[#18312c]"
                  required
                />
              </div>

              <Button type="submit" variant="secondary">
                Perbarui Akun Target
              </Button>
            </form>
          </Card>
        </div>

        {/* Struktur Folder Otomatis di Google Drive */}
        <Card title="Struktur Folder Cloud (DEVFANTA MELATI - AI Agent)">
          <p className="muted mb-4 text-sm">
            Folder berikut secara otomatis dipersiapkan di Google Drive pemilik akun untuk mengorganisasi memori proyek:
          </p>

          <div className="rounded-xl border border-[#cbdcd3] bg-[#fcfdfc] p-4 font-mono text-xs text-[#18312c] space-y-2">
            <div className="flex items-center justify-between font-semibold border-b border-[#e6eee9] pb-2">
              <span>📁 {driveState.rootFolder.name}/</span>
              <span className="rounded bg-[#edf6f0] px-2 py-0.5 text-xs text-[#20584c]">
                {driveState.connected ? (driveState.rootFolder.id ? "Terverifikasi" : "Siap Dibuat") : "Menunggu OAuth"}
              </span>
            </div>

            <div className="pl-4 space-y-2 text-[#526b61]">
              {driveState.subfolders.map((sub) => (
                <div key={sub.name} className="flex items-center justify-between">
                  <span>├── 📁 {sub.name}/</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      sub.status === "synced"
                        ? "bg-[#edf6f0] text-[#20584c]"
                        : "bg-[#f2f6f4] text-[#60736e]"
                    }`}
                  >
                    {sub.status === "synced" ? "Tersinkron" : "Lokal Ready"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <form
              action={async () => {
                "use server";
                await checkDriveStructureAction();
              }}
            >
              <Button type="submit" variant="secondary">
                Periksa & Siapkan Folder di Drive
              </Button>
            </form>
          </div>
        </Card>

        {/* Status Sinkronisasi & Operasi Manual */}
        <Card title="Sinkronisasi Project Memory ke Cloud">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-[#cbdcd3] bg-[#fcfdfc] p-4">
              <div>
                <span className="text-xs font-semibold text-[#60736e] uppercase">Status Sinkronisasi</span>
                <p className="font-semibold text-sm text-[#18312c] mt-0.5">{driveState.syncMessage}</p>
                {driveState.lastSyncedAt && (
                  <p className="text-xs text-[#526b61] mt-1">
                    Terakhir disinkronkan: {new Date(driveState.lastSyncedAt).toLocaleString("id-ID")}
                  </p>
                )}
              </div>

              <div>
                <form
                  action={async () => {
                    "use server";
                    await syncDriveMemoryAction();
                  }}
                >
                  <Button type="submit" disabled={!driveState.connected}>
                    Sinkronkan Memori Sekarang
                  </Button>
                </form>
              </div>
            </div>

            <div className="text-xs text-[#526b61] space-y-1">
              <p>
                ✓ <strong>Lintas Sesi:</strong> Agen baru membaca <code>Memory/project-memory.json</code> saat memulai task untuk memahami riwayat keputusan, checkpoint, dan task yang belum tuntas.
              </p>
              <p>
                ✓ <strong>Lintas Provider:</strong> Model Gemini, OpenAI, atau Claude membaca context format standar yang sama tanpa ketergantungan pada vendor tertentu.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}
