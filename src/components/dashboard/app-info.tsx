import Link from "next/link";
import packageInfo from "../../../package.json";
import { APP_CONFIG } from "@/config/app";
import { Card, Info } from "./ui";
export function AppInfo() {
  return <Card title="Tentang aplikasi"><dl className="grid gap-5 sm:grid-cols-2"><Info label="Nama aplikasi" value={APP_CONFIG.name} /><Info label="Versi" value={packageInfo.version} /><Info label="Lingkungan" value={process.env.NODE_ENV === "production" ? "Production" : "Development"} /><Info label="Teknologi utama" value="Next.js · Supabase" /></dl><p className="muted mt-6 text-sm">© {new Date().getFullYear()} {APP_CONFIG.name}</p><div className="mt-4 flex flex-wrap gap-5 text-sm underline"><Link href={APP_CONFIG.routes.privacy}>Draf kebijakan privasi</Link><Link href={APP_CONFIG.routes.terms}>Draf syarat penggunaan</Link></div></Card>;
}
