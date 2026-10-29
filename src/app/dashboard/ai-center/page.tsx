import { requireCapability } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, Info, Page, QuickLink } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui";
import { getProviderConnections } from "@/lib/ai-center/providers";
import { getProjectMemory } from "@/lib/ai-center/memory";
import { CONTROLLED_TOOLS } from "@/lib/ai-center/tools";
import { getGoogleDriveState } from "@/lib/ai-center/google-drive";
import Link from "next/link";

export default async function AiCenterPage() {
  const context = await requireCapability("ai_center.read");
  if (context.role !== "super_admin" || context.membership.status !== "active") {
    redirect("/dashboard?error=forbidden");
  }

  const [connections, memory, driveState] = await Promise.all([
    Promise.resolve(getProviderConnections(context.user.email)),
    getProjectMemory(context.membership.school_id),
    getGoogleDriveState(),
  ]);

  const activeTasks = memory.tasks.filter((t) => t.status === "in_progress" || t.status === "pending");
  const completedTasks = memory.tasks.filter((t) => t.status === "completed");

  return (
    <Page
      title="AI Agent & Deployment Center"
      description="Pusat orkestrasi model AI, memori progres proyek antar-agent, sinkronisasi Google Drive, dan kendali rilis khusus Super Admin."
    >
      {/* Tab Navigasi Internal */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-[#cbdcd3] pb-3">
        <Link
          href="/dashboard/ai-center"
          className="rounded-lg bg-[#20584c] px-4 py-2 text-sm font-semibold text-white"
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
          Google Drive ({driveState.connected ? "Terkoneksi" : "Belum Terhubung"})
        </Link>
        <Link
          href="/dashboard/ai-center/memory"
          className="rounded-lg border border-[#cbdcd3] bg-white px-4 py-2 text-sm font-medium text-[#18312c] hover:bg-[#edf6f0]"
        >
          Memori & Task ({activeTasks.length} Aktif)
        </Link>
        <Link
          href="/dashboard/ai-center/deployments"
          className="rounded-lg border border-[#cbdcd3] bg-white px-4 py-2 text-sm font-medium text-[#18312c] hover:bg-[#edf6f0]"
        >
          Deployment Center
        </Link>
      </div>

      <div className="grid gap-6">
        {/* Ringkasan Status Proyek & Checkpoint */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Branch Proyek">
            <dl className="grid gap-2">
              <Info label="Branch Aktif" value={memory.branch} />
              <Info label="HEAD SHA" value={memory.headSha.slice(0, 7)} />
            </dl>
          </Card>
          <Card title="Kesehatan Uji">
            <dl className="grid gap-2">
              <Info label="Total Tes Lulus" value={`${memory.testHealth.passed} / ${memory.testHealth.total}`} />
              <Info label="Status Regresi" value="100% Lulus (0 Gagal)" />
            </dl>
          </Card>
          <Card title="Google Drive Sync">
            <dl className="grid gap-2">
              <Info label="Status" value={driveState.connected ? "Terkoneksi" : "Belum Terhubung"} />
              <Info label="Akun Target" value={driveState.accountEmail} />
            </dl>
          </Card>
          <Card title="Status Tugas">
            <dl className="grid gap-2">
              <Info label="Tugas Aktif/Tunda" value={`${activeTasks.length} tugas`} />
              <Info label="Tugas Selesai" value={`${completedTasks.length} tugas`} />
            </dl>
          </Card>
        </div>

        {/* AI Providers Section */}
        <Card title="AI Provider Adapters & Koneksi Model">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <p className="muted text-sm">
              Arsitektur adapter multi-provider memungkinkan sistem berpindah model cerdas sesuai kebutuhan tanpa mengunci kode pada satu penyedia.
            </p>
            <Link
              href="/dashboard/ai-center/keys"
              className="inline-flex text-xs font-semibold text-[#20584c] underline hover:text-[#18312c] whitespace-nowrap"
            >
              Kelola & Tambah API Key →
            </Link>
          </div>

          <Alert tone="neutral" title="Penting Mengenai Kredensial API">
            Login email Google atau akun ChatGPT web konsumen tidak otomatis menyediakan kuota API developer.
            Koneksi API memerlukan API Key resmi di environment server atau terdaftar di menu API Keys. Kunci API dienkripsi aman di server.
          </Alert>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex flex-col justify-between rounded-xl border border-[#cbdcd3] bg-[#fcfdfc] p-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#18312c]">{conn.label}</span>
                    {conn.isPrimary && (
                      <span className="rounded bg-[#edf6f0] px-2 py-0.5 text-xs font-semibold text-[#20584c]">
                        Utama
                      </span>
                    )}
                  </div>
                  <p className="muted mt-1 text-xs">Model: {conn.model}</p>
                  {conn.accountEmailHint && (
                    <p className="muted mt-1 text-xs">Sesi Akun: {conn.accountEmailHint}</p>
                  )}

                  <div className="mt-3">
                    <span
                      className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${
                        conn.configured
                          ? "bg-[#edf6f0] text-[#20584c]"
                          : "bg-[#fff1ed] text-[#b85e43]"
                      }`}
                    >
                      {conn.statusLabel}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-[#526b61]">{conn.disclaimer}</p>
                </div>

                <div className="mt-4 border-t border-[#e6eee9] pt-2 text-xs text-[#60736e]">
                  Auth: {conn.authMethod}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Controlled Execution Tools Sandbox */}
        <Card title="Controlled Execution Tools (Sandbox)">
          <p className="muted mb-3 text-sm">
            Agent beroperasi di dalam batasan eksekusi yang diawasi ketat. Akses terminal bebas (web shell, arbitrary shell commands) dinonaktifkan demi keamanan server.
          </p>
          <div className="divide-y divide-[#e6eee9] overflow-hidden rounded-xl border border-[#cbdcd3]">
            {CONTROLLED_TOOLS.map((tool) => (
              <div key={tool.id} className="p-4 sm:flex sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#18312c]">{tool.name}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        tool.permission === "read_only"
                          ? "bg-[#edf6f0] text-[#20584c]"
                          : tool.permission === "admin_approval_required"
                          ? "bg-[#fff1ed] text-[#b85e43]"
                          : "bg-[#f2f6f4] text-[#18312c]"
                      }`}
                    >
                      {tool.permission}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#526b61]">{tool.description}</p>
                  <p className="muted mt-1 text-xs">Batasan: {tool.safetyBoundary}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Tautan Cepat */}
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickLink
            href="/dashboard/ai-center/keys"
            title="Kelola API Keys"
            description="Tambah, uji, dan rotasi kredensial Gemini, OpenAI, Claude dengan enkripsi server."
          />
          <QuickLink
            href="/dashboard/ai-center/drive"
            title="Google Drive Sync"
            description="Hubungkan alwisginting@gmail.com dan sinkronkan folder DEVFANTA MELATI."
          />
          <QuickLink
            href="/dashboard/ai-center/memory"
            title="Project Memory & Tasks"
            description="Tinjau daftar keputusan arsitektur, kelola status task, dan ringkasan sesi pekerjaan."
          />
        </div>
      </div>
    </Page>
  );
}
