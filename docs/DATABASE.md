# Database

Migration awal membuat `schools`, `profiles`, dan `school_memberships`, enum `app_role` dan `membership_status`, index tenant, serta seed `KB DEVFANTA MELATI`.

Registrasi tidak memilih role. Trigger `on_auth_user_created` membuat profile dan membership `pending` tanpa role untuk sekolah seed. Admin menyetujui membership menjadi `active` dan menetapkan role melalui operasi server-side. Status membership: `pending`, `active`, `rejected`, `suspended`.

Migration lanjutan `202609100002_auth_membership_security.sql` memperketat policy RLS, mencegah perpindahan `school_id`/`user_id`, menyiapkan private buckets, dan menambahkan policy Storage berbasis folder UUID sekolah. Gunakan folder object dengan format `<school_id>/<user_id>/<filename>`.

Migration `202609110003_academic_master_data.sql` menambahkan `school_id` tenant-scoped pada `semesters`, tabel `classrooms`, index tenant, unique partial index untuk satu tahun ajaran aktif dan satu semester aktif per tahun ajaran, serta trigger validasi rentang tanggal dan kesesuaian sekolah. Migration ini tidak membuat enrollment atau tabel siswa.

Aktivasi tahun ajaran dan semester menggunakan RPC `activate_academic_year` dan `activate_semester`. Masing-masing menonaktifkan record aktif lain lalu mengaktifkan target dalam satu transaksi PostgreSQL, dengan authorization role tetap diverifikasi melalui authenticated session dan RLS.

Migration `202609110004_semester_defaults.sql` membuat semester Ganjil dan Genap otomatis saat tahun ajaran baru dibuat, serta mengisi default untuk tahun ajaran existing. Super admin dapat mengoreksi nama semester; role lain tetap menggunakan nama standar melalui Server Action dan trigger database.

Migration `202609110005_feedback.sql` membuat tabel `feedbacks` tenant-scoped untuk saran, bug, keluhan, dan masukan lain. User dan sekolah tidak dikirim sebagai identitas terpercaya dari browser; Server Action mengambil keduanya dari session dan membership aktif.

Feedback mempertahankan record saat profile user dihapus dengan `ON DELETE RESTRICT`; ini dipilih untuk menjaga audit trail, sehingga penghapusan profile perlu ditangani sebagai keputusan lifecycle terpisah. Penghapusan sekolah tetap cascade sesuai lifecycle tenant.

## Backup

Database operasional tetap berada di Supabase PostgreSQL. Aktifkan backup otomatis/PITR sesuai paket Supabase, jadwalkan export berkala ke lokasi penyimpanan terenkripsi terpisah, batasi akses restore, dan uji pemulihan secara periodik. GitHub hanya menyimpan source code dan migration, bukan dump data siswa.

Perubahan schema harus melalui migration yang ditinjau. Jangan menyimpan data pribadi, dump database, atau file backup di repository.
