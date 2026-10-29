import { requireCapability } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, Page } from "@/components/dashboard/ui";
import { Alert, Button } from "@/components/ui";
import { getProjectMemory } from "@/lib/ai-center/memory";
import { updateMemoryTask } from "../actions";
import Link from "next/link";

export default async function AiCenterMemoryPage() {
  const context = await requireCapability("ai_center.read");
  if (context.role !== "super_admin" || context.membership.status !== "active") {
    redirect("/dashboard?error=forbidden");
  }

  const memory = await getProjectMemory(context.membership.school_id);

  return (
    <Page
      title="Memori Proyek Persisten"
      description="Konteks kerja terpadu yang dibagikan ke semua agent: task, keputusan arsitektur, dan riwayat pekerjaan."
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
          className="rounded-lg bg-[#20584c] px-4 py-2 text-sm font-semibold text-white"
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
        {/* Status Engine Persistensi */}
        <Alert tone="neutral" title="Status Engine Persistensi Memori">
          <p className="mb-1 text-xs">
            <strong>Engine Aktif:</strong> {memory.storageEngine.description}
          </p>
          <p className="text-xs text-[#526b61]">
            <strong>Kebutuhan Masa Depan:</strong> {memory.storageEngine.requirementRemaining}
          </p>
        </Alert>

        {/* Task Board */}
        <Card title="Daftar Task Proyek (Agent Tasks)">
          <p className="muted mb-4 text-sm">
            Task dikelola dan dipantau oleh agent sebelum dan sesudah eksekusi pekerjaan agar tidak terjadi pekerjaan berulang antar-sesi.
          </p>

          <div className="grid gap-4">
            {memory.tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-[#cbdcd3] bg-[#fcfdfc] p-4 sm:flex sm:items-start sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#18312c]">{task.title}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        task.status === "completed"
                          ? "bg-[#edf6f0] text-[#20584c]"
                          : task.status === "in_progress"
                          ? "bg-[#eaf0ff] text-[#2c5282]"
                          : task.status === "failed"
                          ? "bg-[#fff1ed] text-[#b85e43]"
                          : "bg-[#f2f6f4] text-[#60736e]"
                      }`}
                    >
                      {task.status}
                    </span>
                    <span className="rounded bg-[#f2f6f4] px-2 py-0.5 text-xs text-[#526b61]">
                      {task.category}
                    </span>
                  </div>
                  <p className="text-sm text-[#526b61]">{task.summary}</p>
                  <p className="muted text-xs">Diperbarui: {new Date(task.updatedAt).toLocaleString("id-ID")}</p>
                </div>

                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await updateMemoryTask({ success: true, message: "" }, formData);
                  }}
                  className="mt-3 flex items-center gap-2 sm:mt-0"
                >
                  <input type="hidden" name="taskId" value={task.id} />
                  <select
                    name="status"
                    defaultValue={task.status}
                    className="rounded-lg border border-[#cbdcd3] bg-white px-2 py-1.5 text-xs font-medium text-[#18312c]"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                  <Button type="submit">Ubah</Button>
                </form>
              </div>
            ))}
          </div>
        </Card>

        {/* Keputusan Arsitektur (ADR) */}
        <Card title="Catatan Keputusan Arsitektur (Decisions Log)">
          <p className="muted mb-4 text-sm">
            Prinsip dan ketetapan yang mengikat semua agent. Setiap agent membaca ini agar tidak merusak aturan dasar repository.
          </p>
          <div className="divide-y divide-[#e6eee9] rounded-xl border border-[#cbdcd3]">
            {memory.decisions.map((dec) => (
              <div key={dec.id} className="p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#18312c]">{dec.title}</h4>
                  <span className="text-xs text-[#60736e]">{dec.date}</span>
                </div>
                <p className="mt-1 text-sm text-[#526b61]"><strong>Alasan:</strong> {dec.rationale}</p>
                <p className="mt-1 text-xs text-[#20584c]"><strong>Dampak:</strong> {dec.impact}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Histori Perubahan Memori */}
        {memory.history && memory.history.length > 0 && (
          <Card title="Histori Perubahan & Audit Trail Memori">
            <div className="divide-y divide-[#e6eee9] rounded-xl border border-[#cbdcd3]">
              {memory.history.slice(0, 10).map((hist) => (
                <div key={hist.id} className="p-3 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-[#18312c]">{hist.details}</span>
                    <span className="block text-[#60736e] mt-0.5">Pelaku: {hist.actor}</span>
                  </div>
                  <span className="text-[#60736e] whitespace-nowrap">
                    {new Date(hist.timestamp).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* File Kunci Proyek */}
        <Card title="Peta File Inti (Key Files Registry)">
          <div className="overflow-x-auto rounded-xl border border-[#cbdcd3]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f6f8f5] text-xs uppercase tracking-wider text-[#60736e]">
                <tr>
                  <th className="px-4 py-3">File Path</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Kegunaan & Batasan</th>
                  <th className="px-4 py-3">Terakhir Diverifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6eee9] bg-white">
                {memory.keyFiles.map((file) => (
                  <tr key={file.path}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#20584c]">{file.path}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-[#edf6f0] px-2 py-0.5 text-xs font-medium text-[#20584c]">
                        {file.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#526b61]">{file.purpose}</td>
                    <td className="px-4 py-3 text-xs text-[#60736e]">{file.lastVerified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Riwayat Sesi Agent */}
        <Card title="Log Sesi Agent Terakhir">
          <div className="space-y-3">
            {memory.sessions.map((sess) => (
              <div key={sess.id} className="rounded-xl border border-[#cbdcd3] bg-[#fcfdfc] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#18312c]">{sess.agent}</span>
                  <span className="text-xs text-[#60736e]">{new Date(sess.timestamp).toLocaleString("id-ID")}</span>
                </div>
                <p className="mt-2 text-sm text-[#526b61]">{sess.taskSummary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sess.verifiedChecks.map((chk, i) => (
                    <span key={i} className="rounded bg-[#edf6f0] px-2 py-0.5 text-xs font-medium text-[#20584c]">
                      ✓ {chk}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}
