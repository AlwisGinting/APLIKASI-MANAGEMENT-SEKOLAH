import Link from "next/link";
export default function PrivacyPage() {
  return <main className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-3xl font-semibold">Draf kebijakan privasi</h1><p className="mt-6 rounded-xl border p-4 font-medium">Dokumen ini belum final dan harus direview sebelum penggunaan production formal.</p><p className="mt-6 leading-7">Pengelola sekolah belum mengisi rincian jenis data, tujuan penggunaan, masa penyimpanan, pihak yang dapat mengakses, dan saluran permintaan terkait data pribadi. Informasi tersebut akan dipublikasikan setelah ditinjau.</p><p className="mt-4">Kontak pengelola privasi: Belum diisi.</p><Link href="/" className="mt-8 inline-block underline">Kembali ke beranda</Link></main>;
}
