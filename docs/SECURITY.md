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
