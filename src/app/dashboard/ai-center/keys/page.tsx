import { requireCapability } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, Page } from "@/components/dashboard/ui";
import { Alert, Button } from "@/components/ui";
import { getManagedApiKeys, getKeyHistory } from "@/lib/ai-center/key-management";
import {
  addApiKeyAction,
  toggleApiKeyAction,
  testApiKeyAction,
  deleteApiKeyAction,
} from "../actions";
import Link from "next/link";

export default async function AiCenterKeysPage() {
  const context = await requireCapability("ai_center.read");
  if (context.role !== "super_admin" || context.membership.status !== "active") {
    redirect("/dashboard?error=forbidden");
  }

  const [keys, history] = await Promise.all([
    getManagedApiKeys(),
    getKeyHistory(),
  ]);

  return (
    <Page
      title="Manajemen Kunci API & Provider AI"
      description="Kelola, rotasi, dan uji kredensial API Gemini, OpenAI, Claude secara terenkripsi AES-256 khusus Super Admin."
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
          className="rounded-lg bg-[#20584c] px-4 py-2 text-sm font-semibold text-white"
        >
          API Keys & Provider ({keys.length})
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
          className="rounded-lg border border-[#cbdcd3] bg-white px-4 py-2 text-sm font-medium text-[#18312c] hover:bg-[#edf6f0]"
        >
          Deployment Center
        </Link>
      </div>

      <div className="grid gap-6">
        {/* Penjelasan Keamanan Enkripsi */}
        <Alert tone="neutral" title="Standar Enkripsi & Pemisahan Akun">
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>
              <strong>Enkripsi Server-Side:</strong> Seluruh secret API key dienkripsi dengan algoritma <code>AES-256-GCM</code> di server. Plaintext tidak pernah disimpan di database, Google Drive, maupun file log.
            </li>
            <li>
              <strong>Pembedaan Kredensial:</strong> Akun Google pribadi/Gmail dan langganan web ChatGPT Plus konsumen <strong>bukan</strong> API key developer. Akses otomatis memerlukan API key berbayar dari console developer resmi.
            </li>
          </ul>
        </Alert>

        {/* Formulir Tambah / Registrasi Kunci Baru */}
        <Card title="Tambah / Rotasi Kunci API Baru">
          <p className="muted mb-4 text-sm">
            Daftarkan API Key baru. Kunci akan otomatis diuji formatnya dan dienkripsi sebelum disimpan ke server.
          </p>

          <form
            action={async (formData: FormData) => {
              "use server";
              await addApiKeyAction({ success: true, message: "" }, formData);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="block text-xs font-semibold text-[#18312c] mb-1">
                Provider AI
              </label>
              <select
                name="providerType"
                defaultValue="gemini"
                className="w-full rounded-lg border border-[#cbdcd3] bg-white px-3 py-2 text-sm text-[#18312c]"
                required
              >
                <option value="gemini">Google Gemini API (Google AI Studio)</option>
                <option value="openai">OpenAI Platform (API gpt-4o)</option>
                <option value="anthropic">Anthropic Console (Claude 3.7)</option>
                <option value="custom">Custom Provider Endpoint</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18312c] mb-1">
                Label Kunci
              </label>
              <input
                type="text"
                name="label"
                placeholder="Contoh: Gemini Primary Key (Proyek 2026)"
                className="w-full rounded-lg border border-[#cbdcd3] bg-white px-3 py-2 text-sm text-[#18312c]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18312c] mb-1">
                Email Pemilik Kredensial
              </label>
              <input
                type="email"
                name="ownerEmail"
                defaultValue={context.user.email || "alwisginting@gmail.com"}
                className="w-full rounded-lg border border-[#cbdcd3] bg-white px-3 py-2 text-sm text-[#18312c]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18312c] mb-1">
                Model Default
              </label>
              <input
                type="text"
                name="model"
                defaultValue="gemini-2.5-flash"
                placeholder="Contoh: gemini-2.5-flash, gpt-4o, claude-3-7-sonnet"
                className="w-full rounded-lg border border-[#cbdcd3] bg-white px-3 py-2 text-sm text-[#18312c]"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#18312c] mb-1">
                Secret API Key (Plaintext tidak akan pernah ditampilkan kembali)
              </label>
              <input
                type="password"
                name="secret"
                placeholder="Paste API Key (AIzaSy... atau sk-...)"
                className="w-full rounded-lg border border-[#cbdcd3] bg-white px-3 py-2 text-sm text-[#18312c] font-mono"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit">Simpan & Enkripsi Kunci</Button>
            </div>
          </form>
        </Card>

        {/* Daftar Kunci API Terdaftar */}
        <Card title="Daftar Kunci API Terenkripsi">
          {keys.length === 0 ? (
            <p className="muted text-sm">
              Belum ada kunci API yang didaftarkan secara mandiri. Sistem menggunakan environment variable server jika tersedia.
            </p>
          ) : (
            <div className="divide-y divide-[#e6eee9] rounded-xl border border-[#cbdcd3] overflow-hidden">
              {keys.map((k) => (
                <div key={k.id} className="p-4 bg-white flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-[#18312c]">{k.label}</span>
                      <span className="rounded bg-[#edf6f0] px-2 py-0.5 text-xs font-semibold text-[#20584c] uppercase">
                        {k.providerType}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          k.isActive ? "bg-[#edf6f0] text-[#20584c]" : "bg-[#fff1ed] text-[#b85e43]"
                        }`}
                      >
                        {k.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                      {k.testStatus && (
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            k.testStatus === "success"
                              ? "bg-[#edf6f0] text-[#20584c]"
                              : k.testStatus === "failed"
                              ? "bg-[#fff1ed] text-[#b85e43]"
                              : "bg-[#f2f6f4] text-[#60736e]"
                          }`}
                        >
                          Uji: {k.testStatus}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-[#526b61]">
                      <span>Secret: <code className="rounded bg-[#f2f6f4] px-1 py-0.5 font-mono text-[#18312c]">{k.maskedSecret}</code></span>
                      <span>Model: {k.model}</span>
                      <span>Pemilik: {k.ownerEmail}</span>
                    </div>
                    {k.testMessage && (
                      <p className="text-xs text-[#60736e] italic">Catatan uji: {k.testMessage}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                    {/* Form Uji */}
                    <form
                      action={async () => {
                        "use server";
                        const fd = new FormData();
                        fd.set("keyId", k.id);
                        await testApiKeyAction({ success: true, message: "" }, fd);
                      }}
                    >
                      <Button type="submit" variant="secondary">
                        Uji Format
                      </Button>
                    </form>

                    {/* Form Toggle Aktif/Nonaktif */}
                    <form
                      action={async () => {
                        "use server";
                        const fd = new FormData();
                        fd.set("keyId", k.id);
                        fd.set("isActive", String(!k.isActive));
                        await toggleApiKeyAction({ success: true, message: "" }, fd);
                      }}
                    >
                      <Button type="submit" variant="secondary">
                        {k.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </form>

                    {/* Form Hapus */}
                    <form
                      action={async () => {
                        "use server";
                        const fd = new FormData();
                        fd.set("keyId", k.id);
                        await deleteApiKeyAction({ success: true, message: "" }, fd);
                      }}
                    >
                      <Button type="submit" variant="destructive">
                        Hapus
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Riwayat Pergantian / Pengujian Kunci */}
        <Card title="Riwayat Aktivitas & Audit Rotasi Kunci">
          {history.length === 0 ? (
            <p className="muted text-sm">Belum ada riwayat aktivitas kunci.</p>
          ) : (
            <div className="divide-y divide-[#e6eee9] rounded-xl border border-[#cbdcd3] overflow-hidden">
              {history.slice(0, 15).map((h) => (
                <div key={h.id} className="p-3 text-xs bg-white flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-[#18312c]">{h.details}</span>
                    <span className="block text-[#60736e] mt-0.5">Oleh: {h.actor} · Aksi: {h.action}</span>
                  </div>
                  <span className="text-[#60736e] whitespace-nowrap">
                    {new Date(h.timestamp).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}

