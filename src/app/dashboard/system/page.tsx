import packageInfo from "../../../../package.json";
import { APP_CONFIG } from "@/config/app";
import { requireCapability } from "@/lib/auth";
import { Card, Info, Page } from "@/components/dashboard/ui";

function safeCommitSha() {
  const value = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  return value && /^[a-f0-9]{7,64}$/i.test(value) ? value : "Tidak tersedia";
}

function safeRepositoryUrl() {
  const value = process.env.NEXT_PUBLIC_REPOSITORY_URL;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export default async function SystemPage() {
  const context = await requireCapability("system.read");
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const repositoryUrl = safeRepositoryUrl();
  const environment = process.env.NODE_ENV === "production" ? "Production" : "Development";

  return <Page title="Sistem" description="Informasi aman tentang aplikasi dan kesiapan fondasi.">
    <div className="grid gap-5 sm:grid-cols-2">
      <Card title="Aplikasi"><dl className="grid gap-4"><Info label="Nama aplikasi" value={APP_CONFIG.name} /><Info label="Versi" value={packageInfo.version} /><Info label="Lingkungan" value={environment} /></dl></Card>
      <Card title="Kesehatan sistem"><dl className="grid gap-4"><Info label="Aplikasi" value="Berjalan" /><Info label="Database" value={context.school ? "Terhubung melalui sesi aktif" : "Tidak tersedia"} /></dl></Card>
      <Card title="Autentikasi"><dl className="grid gap-4"><Info label="Supabase Auth" value={supabaseConfigured ? "Terkonfigurasi" : "Belum dikonfigurasi"} /><Info label="Sesi" value="Cookie SSR Supabase" /></dl></Card>
      <Card title="Development"><dl className="grid gap-4"><Info label="Commit" value={safeCommitSha()} /><Info label="Repository" value={repositoryUrl ? "Terkonfigurasi" : "Tidak dikonfigurasi"} /></dl>{repositoryUrl && <a href={repositoryUrl} rel="noreferrer" target="_blank" className="mt-5 inline-block text-sm font-semibold underline">Buka repository</a>}</Card>
      <Card title="Foundation"><dl className="grid gap-4"><Info label="Authorization" value="Active membership + capability + RLS" /><Info label="Migration" value="001-007 immutable; review 008+ required" /><Info label="Storage" value="Hardening belum diaktifkan" /><Info label="Backup" value="Prosedur manual dan review owner" /></dl></Card>
    </div>
  </Page>;
}