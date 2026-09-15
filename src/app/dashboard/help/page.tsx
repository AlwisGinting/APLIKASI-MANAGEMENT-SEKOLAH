import Link from "next/link";
import { getSchoolContext } from "@/lib/school";
import { APP_CONFIG } from "@/config/app";
import { Page, Card, Info } from "@/components/dashboard/ui";
const questions = [
  ["Bagaimana mendaftar akun?", "Buka Daftar pada halaman masuk, isi nama dan email yang Anda gunakan, lalu buat kata sandi minimal 8 karakter beserta konfirmasi. Verifikasi email dan tunggu persetujuan admin sekolah."],
  ["Bagaimana memperbarui profil?", "Buka Profil, ubah nama lengkap atau nomor telepon, lalu simpan. Email, role, dan membership tidak dapat diubah melalui formulir profil."],
  ["Bagaimana membuat kata sandi baru?", "Buka Keamanan pada Pengaturan untuk mengganti kata sandi, atau gunakan tautan pemulihan dari email jika lupa. Isi kata sandi baru minimal 8 karakter dengan konfirmasi yang sama."],
  ["Bagaimana cara masuk?", "Gunakan email dan kata sandi akun yang sudah didaftarkan. Verifikasi email terlebih dahulu; akses sekolah memerlukan persetujuan administrator."],
  ["Saya lupa kata sandi", "Pilih Lupa kata sandi pada halaman masuk. Minta tautan pemulihan, lalu buka email di browser yang sama. Tautan tidak valid atau kedaluwarsa dapat diganti dengan permintaan baru."],
  ["Email verifikasi belum diterima", "Periksa folder spam dan pastikan alamat email benar. Jika masih belum tersedia, hubungi admin sekolah. Jangan bagikan tautan verifikasi kepada orang lain."],
  ["Apa arti pending approval?", "Email sudah diverifikasi tetapi akses sekolah masih ditinjau administrator. Hanya administrator yang dapat menyetujui atau mengubah role akun."],
  ["Bagaimana mengirim feedback?", "Gunakan tombol Feedback di sudut bawah. Pilih jenis masukan, isi judul dan pesan, lalu kirim. Jangan memasukkan kata sandi atau informasi sensitif. Periksa tanggapan/status di halaman Feedback."],
  ["Mengapa sebagian menu tidak terlihat?", "Menu mengikuti role dan sekolah aktif Anda. Hubungi admin sekolah jika akses yang dibutuhkan belum tersedia."],
];
export default async function HelpPage() {
  const { details } = await getSchoolContext();
  return <Page title="Pusat bantuan" description="Panduan singkat untuk menggunakan akun dan ruang kerja sekolah."><Card title="Pertanyaan umum"><div className="divide-y">{questions.map(([question, answer]) => <details key={question} className="py-4"><summary className="cursor-pointer font-medium">{question}</summary><p className="muted mt-3 leading-7">{answer}</p></details>)}</div></Card><Card title="Hubungi admin sekolah"><dl className="grid gap-5 sm:grid-cols-2"><Info label="Telepon" value={details?.phone} /><Info label="Email" value={details?.email} /></dl><p className="muted mt-4 text-sm">Jika kontak belum diisi, hubungi pengelola sekolah melalui saluran yang biasa Anda gunakan.</p><Link className="mt-5 inline-block underline" href={APP_CONFIG.routes.feedback}>Lihat feedback saya</Link></Card></Page>;
}
