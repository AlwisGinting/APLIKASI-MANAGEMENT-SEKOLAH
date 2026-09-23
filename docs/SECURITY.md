> **Auth update — 2026-09-24:** See [combined recovery + Google login review](AUTH-FOUNDATION.md) for current source behavior, required provider/redirect configuration, validation and remaining manual gates. This supersedes older auth-flow descriptions below; no production deployment has been performed.

> **Current status — 2026-09-24:** Owner confirms migrations 001–007 applied in production and immutable. Do not edit or rerun them. Statements below saying 007 (or earlier migrations) is draft/unapplied describe historical work, not current deployment instructions. See [current readiness audit](READINESS-2026-09-24.md) and [Stage C Storage/backup design](STORAGE.md). Live RLS and authenticated smoke testing remain manual gates. No 008, Storage hardening deployment, Drive connection or backup automation was performed in this review.

# Security

- Aktifkan RLS untuk semua tabel tenant dan selalu filter berdasarkan membership `active`.
- Gunakan Supabase Auth untuk email verification, password reset, dan session cookie.
- Jangan pernah menaruh service role key di client atau variable `NEXT_PUBLIC_*`.
- Simpan file pribadi di private bucket: `student-documents`, `teacher-documents`, `attendance-photos`, dan `avatars`.
- Tabel metadata file menyimpan `school_id`, pemilik, kategori, ukuran, mime type, dan storage path; binary tetap di Storage.
- Gunakan signed URL berumur pendek saat file pribadi perlu ditampilkan.
- Jangan log NIK, NISN, nomor telepon, token, atau isi dokumen.
- Terapkan validasi ukuran, MIME type, nama file, dan otorisasi tenant pada upload.

## Supabase keys

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` boleh digunakan oleh browser, tetapi tetap wajib dilindungi RLS. `SUPABASE_SECRET_KEY` hanya server-side, tidak membawa cookie/session user, dan dapat melewati RLS; gunakan hanya untuk operasi sistem yang benar-benar membutuhkan akses administratif.

Approve, reject, suspend, dan perubahan role tidak memakai secret key. Server Action memverifikasi user serta role admin melalui authenticated server client, lalu PostgreSQL RLS memvalidasi mutation pada tenant yang sama. Secret key hanya digunakan untuk membaca email Auth pada halaman manajemen pengguna, karena email berada di `auth.users` dan tidak tersedia melalui client session biasa.

## Bootstrap admin pertama

Registrasi publik selalu membuat membership `pending` tanpa role. Setelah user terverifikasi, ambil UUID user dari Supabase Dashboard Auth dan jalankan SQL manual berikut di SQL Editor. Ganti nilai `USER_UUID` dengan UUID user yang sudah diverifikasi.

```sql
update public.school_memberships
set status = 'active', role = 'super_admin', approved_by = 'USER_UUID', approved_at = now(), updated_at = now()
where school_id = '00000000-0000-0000-0000-000000000001'
	and user_id = 'USER_UUID';
```

Pastikan hasil update tepat satu baris. Setelah admin pertama dapat masuk, semua persetujuan berikutnya dilakukan dari `/dashboard/users`. Jangan membuat endpoint publik untuk bootstrap role.

## Master data akademik

Route `/dashboard/master` hanya dapat dibaca oleh membership aktif dengan role `super_admin`, `kepala_sekolah`, `operator`, atau `guru`. Mutation hanya diterima untuk tiga role pertama melalui authenticated server client dan RLS. `school_id` selalu berasal dari membership aktif server-side; form tidak boleh menentukan tenant.

RLS pada `academic_years`, `semesters`, dan `classrooms` membatasi query ke tenant aktif. Guru hanya memiliki akses baca. Operator dapat membuat dan mengubah data tetapi tidak menghapus. Super admin dan kepala sekolah dapat menghapus bila tidak ada dependensi yang belum ditangani.

## Feedback

Feedback berada di tenant aktif dan memakai authenticated Supabase client, bukan `SUPABASE_SECRET_KEY`. Saat insert, Server Action mengisi `user_id`, `school_id`, dan status `open`; nilai tersebut tidak dipercaya dari browser. Pengguna hanya dapat membaca feedback miliknya. Super admin dan kepala sekolah dapat membaca serta mengubah status feedback di sekolahnya; orang tua, guru, dan operator tidak mendapat akses daftar global.

## Local dan production Auth

Local dan production harus menunjuk ke project Supabase yang sama bila akun Auth ingin berlaku di keduanya. Perbedaan origin hanya memisahkan cookie session; password dan user Auth tidak disalin ke database lain. Jika project URL berbeda, itu adalah configuration mismatch, bukan masalah password lokal.

Tidak ada custom cookie domain atau shared-cookie configuration pada Supabase SSR client. Browser menyimpan session local dan production secara terpisah, sebagaimana mestinya. Jangan mencoba membagikan cookie antar-origin.

## Hardening yang diterapkan

- Safe internal redirect menolak absolute URL, protocol-relative URL, backslash, whitespace/control character, dan encoded separator. Callback tidak mempercayai `next` sebagai bukti recovery.
- Callback mengenali event `PASSWORD_RECOVERY` dari SDK saat kode berhasil ditukar. Kode hilang/tidak valid/kedaluwarsa menjadi error generik; token tidak diteruskan ke URL tujuan.
- Password minimum 8 karakter dan confirmation divalidasi ulang server-side. Sesudah update sukses, marker recovery dan cookie session browser ini dibersihkan sebelum kembali ke login.
- Error boundary global route dan dashboard tidak merender raw error/stack; kegagalan query tidak dianggap sebagai daftar kosong. Logger aplikasi hanya mencatat kategori.
- Header `nosniff`, referrer policy, permissions policy, dan SAMEORIGIN dipertahankan dari working tree existing. Callback memakai `no-referrer`; response session/private `no-store`.
- Secret client tetap `server-only`, hanya digunakan untuk lookup email Auth setelah pemeriksaan admin tenant. Tidak ada secret dalam Client Component.

## Temuan kebijakan yang dipertahankan

RLS membership 002 mengizinkan kepala sekolah dan super admin mengelola role, termasuk super admin, dalam tenant mereka. Larangan edit diri sendiri dan menurunkan super admin terakhir saat ini hanya pada Server Action; request database langsung dapat melewati guard aplikasi itu. Perlindungan super admin terakhir juga belum atomik terhadap perubahan bersamaan. Jangan menganggap guard UI sebagai enforcement database. Pengetatan memerlukan keputusan role/lifecycle dan migration lanjutan dengan uji konkurensi; tidak diubah diam-diam pada migration historical.

Policy Storage 002 memberi semua membership aktif akses baca/tulis/hapus object di folder tenant, tanpa pembatasan role/bucket/pemilik yang lebih rinci. Ini mempertahankan isolation antar sekolah, tetapi belum menjadi kebijakan akses dokumen sensitif per pengguna. Jangan mengunggah dokumen sensitif sebelum kebijakan tersebut ditetapkan dan diperketat melalui migration baru.

Policy insert membership memperbolehkan pengguna mengajukan membership pending tanpa role ke school_id lain; tidak otomatis memberi akses aktif. `schools.is_active` saat ini tidak diperiksa oleh helper akses existing setelah membership terbentuk. Semantik penonaktifan sekolah belum ditetapkan; perilaku dipertahankan.

## Account dan app shell

Profil pribadi memakai authenticated SSR client, update hanya full_name/phone/updated_at pada id dari user server. Form tidak dapat menetapkan role, membership, school_id, atau email. School edit menjalankan requireSchoolAdmin, memfilter sekolah dari membership aktif, dan hanya mengirim kolom allowlist. Izin RLS/grants 006 wajib diterapkan manual sebelum edit sekolah aktif.

Upload avatar/logo belum diaktifkan: policy Storage 002 masih memberi anggota aktif akses luas terhadap object satu tenant, belum membatasi pemilik/bucket untuk foto pribadi. Gunakan inisial sampai policy upload/read/update/delete yang owner- dan bucket-scoped, validasi MIME serta ukuran maksimum 2 MB, dan jalur tenant/user direview.

Security settings memakai updateUser dengan password/current_password dan signOut scope local/global dari session user; tidak memakai admin client. Enforcement current-password/reauthentication mengikuti konfigurasi Supabase Auth dan wajib diuji manual; jangan menganggap isian form sebagai policy Auth. Global logout memutus refresh session, tetapi access yang sudah diterbitkan bisa tetap berlaku sampai kedaluwarsa. UI menjelaskan batas ini tanpa mengekspos token.

Feedback current_path disaring menjadi internal pathname saja (query/fragment dibuang). Mutation status memeriksa row yang benar-benar diperbarui agar id lintas tenant/tidak ditemukan tidak menghasilkan success palsu. Privacy/terms hanya draf, bukan kebijakan hukum final.

## Capability dan isolasi tenant — Tahap A

Semua capability mensyaratkan membership active dan role dikenal. Role/cookie browser tidak menentukan otorisasi. `requireCapability()` fail closed dengan redirect generik. RLS 002–006 tetap security boundary utama; capability tidak menggantikan RLS.

| Capability | Super admin | Kepala sekolah | Operator | Guru | Orang tua |
|---|---|---|---|---|---|
| dashboard.read, profile.read/update_self, school.read | Ya | Ya | Ya | Ya | Ya |
| feedback.create/read_own, activity.read, notifications.read | Ya | Ya | Ya | Ya | Ya |
| school.update, users.read/manage, feedback.manage | Ya | Ya | Tidak | Tidak | Tidak |
| academic.read | Ya | Ya | Ya | Ya | Tidak |
| academic.manage | Ya | Ya | Ya | Tidak | Tidak |
| academic.delete | Ya | Ya | Tidak | Tidak | Tidak |
| academic.custom_semester_name, feedback.delete | Ya | Tidak | Tidak | Tidak | Tidak |

`school.read` mencakup informasi sekolah dalam tenant yang memang bisa dibaca semua member melalui RLS; halaman settings sekolah kini juga read-only bagi guru/orang tua. Capability delete feedback belum menambah UI/action bisnis baru.

School/profile/feedback insert memakai ID context, bukan form. Edit master memverifikasi ID record dan academic year pada tenant aktif; update/delete memakai filter ID + school_id dan memeriksa baris hasil. Semester aktif dibatasi school_id + academic_year_id. Feedback management memakai filter tenant dan menolak hasil nol baris. Membership administration memverifikasi target tenant, melarang edit diri sendiri, memvalidasi role/status terhadap allowlist, dan mempertahankan guard admin terakhir. Role/status pada form ini adalah nilai perubahan yang diotorisasi, bukan identitas privilege caller. Guard admin terakhir application-layer existing bukan jaminan terhadap race concurrent; invariant atomik database membutuhkan review terpisah.

Pending/rejected/suspended tidak memberikan tenant access. Membership dicari ulang setiap request; cookie stale hanya dapat fallback ke membership aktif milik user yang masih valid. React cache tidak bertahan lintas request. RLS mengecek kembali saat query/mutation bila membership berubah selama request.

Pengujian lokal memakai static/mock dan model cache request, bukan bukti database/browser production. Struktur RLS nyata dan kebutuhan fixture terisolasi ada di `tests/integration/README.md` untuk tahap E.

## Tahap B — audit security (draft 007)

Capability baru `audit.read` hanya active super_admin/kepala_sekolah. `activity.read` tetap semua role untuk ringkasan sendiri. Helper audit memeriksa capability secara mandiri, filter school_id dari active tenant dan RLS DB memakai has_school_role tenant. Operator/guru/orang_tua tidak memperoleh audit administratif. Tidak ada client writer, API insert bebas, atau service secret untuk query Activity.

Append-only berlapis: revoke seluruh privilege public/anon/authenticated lalu SELECT authenticated saja; RLS SELECT admins tanpa policy write; trigger menolak UPDATE/DELETE. Dalam alur aplikasi, INSERT hanya melalui function trigger SECURITY DEFINER milik role migration trusted. Privilege service_role/owner tidak diubah untuk tujuan browser security dan operasi privileged berada di luar boundary aplikasi. Function EXECUTE dicabut, search_path fixed pg_catalog, tabel/operasi dibatasi dan tenant/actor berasal row/auth.uid. Audit stamp selalu mengisi waktu dan actor database. Tidak memakai FORCE RLS karena writer owner perlu menulis; owner/superuser masih dapat mengubah DDL/menonaktifkan trigger. Ini bukan tamper-proof terhadap administrator database. Batasi akses DDL/schema creation dan credential owner di luar aplikasi.

Metadata hanya `changed_fields`, `old_status`, `new_status`, `old_role`, `new_role`. Nilai profil, phone/email, isi feedback, dokumen, raw session/auth payload/error stack/password/token/cookie/key tidak disimpan. Perbandingan OLD/NEW JSON bersifat transient dalam function; insert hanya metadata hasil allowlist. Formatter juga menolak unknown key/field/action/enum agar nilai tidak dikenal tidak dipantulkan mentah ke UI. Nama actor dibaca dari profile saat render jika RLS mengizinkan; audit menyimpan UUID saja.

Retensi: belum ada purge otomatis/UI delete/export integration. Tetapkan periode retensi, siapa pemilik keputusan, akses backup, dan prosedur penghapusan terkontrol sebelum volume produksi tumbuh. FK sekolah RESTRICT mencegah penghapusan histori via cascade; archival sekolah/entity tidak menghapus audit. Penghapusan historis, legal hold, atau anonimisasi harus melalui prosedur privileged yang direview, karena append-only sengaja menolak UPDATE/DELETE biasa. Jangan menambahkan data sensitif sebagai solusi pelacakan.

Validasi tahap B adalah static/unit/mock, belum menjalankan SQL/007 atau membuktikan RLS nyata. Review di database disposable harus mencakup rollback saat audit insert gagal, owner/privilege function, direct INSERT/UPDATE/DELETE/TRUNCATE, isolasi dua tenant/lima role, nested defaults/activation, actor NULL/system, profil multi-school/tanpa membership aktif, dan source deletion dengan audit bertahan. Tidak ada claim production audit sudah aktif.


Final hardening sesuai review manual (007 belum applied): rewrite primary key/tenant sumber tetap ditolak. REVOKE hanya PUBLIC/anon/authenticated; tidak mencabut hak service_role. Tidak ada trigger BEFORE TRUNCATE pada audit_logs maupun sumber. Application roles tidak memiliki privilege TRUNCATE, sedangkan privileged owner/maintenance dapat melakukan operasi sesuai privilege/FK existing di luar normal audit trail. Ini tidak menjamin tamper-proof terhadap pemilik database, tidak memeriksa semua grants inherited pada project live, dan bukan pengganti backup. Review default privileges/inherited roles di environment uji tetap diperlukan.

INSERT guard tetap menimpa actor dari auth.uid() dan waktu dari now(), serta memeriksa konteks BEFORE ROW public.audit_logs. Tidak ada writer callable generik. Membership status event hanya changed_fields=[status], old_status/new_status; role event hanya changed_fields=[role], old_role/new_role. Perubahan bersamaan menghasilkan dua event terpisah. Metadata profil global hanya nama field dan dapat muncul di setiap tenant membership ACTIVE subject.
