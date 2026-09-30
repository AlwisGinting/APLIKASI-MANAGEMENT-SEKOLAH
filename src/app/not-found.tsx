import Link from "next/link";
import { PageHeader } from "@/components/ui";
export default function NotFound() {
  return <main className="grid min-h-dvh place-items-center px-4 py-10"><div className="ui-card max-w-lg text-center"><PageHeader title="Halaman tidak ditemukan" description="Periksa alamat halaman atau kembali ke beranda." /><Link href="/" className="ui-button ui-button-primary mt-6">Kembali ke beranda</Link></div></main>;
}
