import Link from "next/link";
export default function TermsPage() {
  return <main className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-3xl font-semibold">Draf syarat penggunaan</h1><p className="mt-6 rounded-xl border p-4 font-medium">Dokumen ini belum final dan harus direview sebelum penggunaan production formal.</p><p className="mt-6 leading-7">Ketentuan penggunaan akun, tanggung jawab pengguna dan pengelola, serta prosedur penanganan masalah belum ditetapkan dalam dokumen ini. Rincian resmi akan tersedia setelah review pengelola sekolah.</p><p className="mt-4">Kontak pengelola: Belum diisi.</p><Link href="/" className="mt-8 inline-block underline">Kembali ke beranda</Link></main>;
}
