import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#f6f8f5] px-6"><div className="text-center"><h1 className="text-2xl font-semibold text-[#18312c]">Halaman tidak ditemukan</h1><Link href="/" className="mt-6 inline-block text-[#20584c]">Kembali ke beranda</Link></div></main>;
}
