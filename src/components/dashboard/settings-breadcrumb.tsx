import Link from "next/link";
import { APP_CONFIG } from "@/config/app";

// PageHeader supplies the labelled nav landmark. Current page is not a link.
export function SettingsBreadcrumb({ current }: { current: string }) {
  return <ol className="shell-breadcrumb">
    <li><Link href={APP_CONFIG.routes.dashboard}>Dashboard</Link></li>
    <li><span aria-hidden="true">/</span><Link href={APP_CONFIG.routes.settings}>Pengaturan</Link></li>
    <li><span aria-hidden="true">/</span><span aria-current="page">{current}</span></li>
  </ol>;
}
