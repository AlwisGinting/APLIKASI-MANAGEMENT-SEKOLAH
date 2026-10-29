import { requireCapability } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, Page } from "@/components/dashboard/ui";
import { Button } from "@/components/ui";
import {
  getDeploymentIntegrations,
  getDeploymentHistory,
  checkPromotionReadiness,
} from "@/lib/ai-center/deployment";
import { requestProductionPromotionAction } from "../actions";
import Link from "next/link";

export default async function AiCenterDeploymentsPage() {
  const context = await requireCapability("ai_center.read");
  if (context.role !== "super_admin" || context.membership.status !== "active") {
    redirect("/dashboard?error=forbidden");
  }

  const integrations = getDeploymentIntegrations();
  const history = getDeploymentHistory();
  const readiness = checkPromotionReadiness();

  return (
    <Page
      title="Deployment & Release Center"
      description="Pusat integrasi resmi GitHub dan Vercel, pemantauan preview build, log verifikasi, dan promosi production terkontrol."
    >
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
          className="rounded-lg border border-[#cbdcd3] bg-white px-4 py-2 text-sm font-medium text-[#18312c] hover:bg-[#edf6f0]"
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
          className="rounded-lg bg-[#20584c] px-4 py-2 text-sm font-semibold text-white"
        >
          Deployment Center
        </Link>
      </div>

      <div className="grid gap-6">
        {/* Status Integrasi Provider Resmi */}
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((item) => (
            <Card key={item.id} title={item.name}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#526b61]">Status Koneksi</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.configured
                        ? "bg-[#edf6f0] text-[#20584c]"
                        : "bg-[#fff1ed] text-[#b85e43]"
                    }`}
                  >
                    {item.statusText}
                  </span>
                </div>

                <div className="rounded-lg border border-[#cbdcd3] bg-[#fcfdfc] p-3 text-xs">
                  {Object.entries(item.details).map(([key, val]) => (
                    <div key={key} className="flex justify-between py-1 border-b border-[#f2f6f4] last:border-0">
                      <span className="font-semibold text-[#18312c]">{key}:</span>
                      <span className="text-[#526b61] truncate max-w-[220px]" title={val}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-[#526b61]">{item.notes}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Preflight Promotion Checklist */}
        <Card title="Preflight Verification Checklist (Promosi ke Production)">
          <p className="muted mb-4 text-sm">
            Promosi ke environment production dilindungi secara ketat. Semua kriteria pre-flight wajib terpenuhi sebelum tindakan promosi dapat disetujui.
          </p>

          <div className="space-y-3">
            {readiness.checklist.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between rounded-lg border border-[#cbdcd3] bg-[#fcfdfc] p-3 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        item.ok ? "bg-[#20584c]" : "bg-[#b85e43]"
                      }`}
                    />
                    <span className="font-semibold text-[#18312c]">{item.label}</span>
                  </div>
                  <p className="text-xs text-[#526b61]">{item.detail}</p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    item.ok
                      ? "bg-[#edf6f0] text-[#20584c]"
                      : "bg-[#fff1ed] text-[#b85e43]"
                  }`}
                >
                  {item.ok ? "LOLOS" : "TERTAHAN"}
                </span>
              </div>
            ))}
          </div>

          {readiness.blockingReasons.length > 0 && (
            <div className="mt-4 rounded-lg border border-[#fbd4cb] bg-[#fff6f4] p-3 text-xs text-[#9c3621]">
              <strong className="block mb-1">Penyebab Tertahan:</strong>
              <ul className="list-disc pl-5 space-y-1">
                {readiness.blockingReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Formulir Promosi Production dengan Konfirmasi Eksplisit */}
        <Card title="Persetujuan Promosi ke Production (Super Admin Guard)">
          <div className="space-y-4">
            <div className="rounded-lg border border-[#ffe082] bg-[#fffdf0] p-4 text-sm text-[#7a5900]">
              <p className="font-semibold mb-1">Perlindungan Rilis Production</p>
              <p className="text-xs leading-relaxed">
                Branch saat ini adalah <code>checkpoint/google-first-basic-access</code>. Cabang <code>main</code> berstatus protected.
                Sesuai aturan repositori, deployment sungguhan ke production hanya dieksekusi setelah persetujuan eksplisit owner repositori dan ketersediaan deploy hook resmi.
              </p>
            </div>

            <form
              action={async (formData: FormData) => {
                "use server";
                await requestProductionPromotionAction({ success: true, message: "" }, formData);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-[#18312c] mb-1">
                  Ketik persis teks berikut untuk mengonfirmasi:{" "}
                  <code className="rounded bg-[#edf6f0] px-1.5 py-0.5 text-[#20584c]">
                    SAYA SETUJU PROMOSI KE PRODUCTION
                  </code>
                </label>
                <input
                  type="text"
                  name="confirmation"
                  placeholder="SAYA SETUJU PROMOSI KE PRODUCTION"
                  className="w-full max-w-md rounded-lg border border-[#cbdcd3] bg-white px-3 py-2 text-sm text-[#18312c] focus:border-[#20584c] focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={!readiness.canPromote}
                  className={
                    readiness.canPromote
                      ? "bg-[#20584c] text-white hover:bg-[#18312c]"
                      : "cursor-not-allowed opacity-50 bg-[#8c9e97] text-white"
                  }
                >
                  Ajukan Permintaan Promosi
                </Button>
                {!readiness.canPromote && (
                  <span className="text-xs text-[#b85e43]">
                    Tombol dinonaktifkan: syarat pre-flight belum lengkap.
                  </span>
                )}
              </div>
            </form>
          </div>
        </Card>

        {/* Riwayat Deployment & Log Build */}
        <Card title="Riwayat Deployment & Log Verifikasi">
          <div className="space-y-4">
            {history.map((record) => (
              <div
                key={record.id}
                className="rounded-xl border border-[#cbdcd3] bg-[#fcfdfc] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f2f6f4] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#18312c]">{record.id}</span>
                    <span className="rounded bg-[#eaf0ff] px-2 py-0.5 text-xs font-semibold text-[#2c5282]">
                      {record.target.toUpperCase()}
                    </span>
                    <span className="rounded bg-[#edf6f0] px-2 py-0.5 text-xs font-semibold text-[#20584c]">
                      {record.status}
                    </span>
                  </div>
                  <span className="text-xs text-[#526b61]">
                    {new Date(record.createdAt).toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-[#526b61]">Commit SHA: </span>
                    <code className="rounded bg-[#f2f6f4] px-1 py-0.5 font-mono text-[#18312c]">
                      {record.commitSha.substring(0, 7)}
                    </code>
                  </div>
                  <div>
                    <span className="text-[#526b61]">Branch: </span>
                    <span className="font-semibold text-[#18312c]">{record.branch}</span>
                  </div>
                  {record.verifiedBy && (
                    <div>
                      <span className="text-[#526b61]">Diverifikasi oleh: </span>
                      <span className="font-medium text-[#18312c]">{record.verifiedBy}</span>
                    </div>
                  )}
                  {record.url && (
                    <div>
                      <span className="text-[#526b61]">URL Preview: </span>
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#20584c] underline hover:text-[#18312c]"
                      >
                        {record.url}
                      </a>
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#18312c] mb-1">
                    Log Build & Verifikasi:
                  </span>
                  <div className="rounded-lg bg-[#18312c] p-3 font-mono text-xs text-[#edf6f0] space-y-1 overflow-x-auto max-h-48">
                    {record.logs.map((log, lIdx) => (
                      <div key={lIdx} className="leading-relaxed">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}
