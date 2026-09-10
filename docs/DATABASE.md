# Database

Migration awal membuat `schools`, `profiles`, dan `school_memberships`, enum `app_role` dan `membership_status`, index tenant, serta seed `KB DEVFANTA MELATI`.

Registrasi tidak memilih role. Trigger `on_auth_user_created` membuat profile dan membership `pending` tanpa role untuk sekolah seed. Admin menyetujui membership menjadi `active` dan menetapkan role melalui operasi server-side. Status membership: `pending`, `active`, `rejected`, `suspended`.

Migration lanjutan `202609100002_auth_membership_security.sql` memperketat policy RLS, mencegah perpindahan `school_id`/`user_id`, menyiapkan private buckets, dan menambahkan policy Storage berbasis folder UUID sekolah. Gunakan folder object dengan format `<school_id>/<user_id>/<filename>`.

## Backup

Database operasional tetap berada di Supabase PostgreSQL. Aktifkan backup otomatis/PITR sesuai paket Supabase, jadwalkan export berkala ke lokasi penyimpanan terenkripsi terpisah, batasi akses restore, dan uji pemulihan secara periodik. GitHub hanya menyimpan source code dan migration, bukan dump data siswa.

Perubahan schema harus melalui migration yang ditinjau. Jangan menyimpan data pribadi, dump database, atau file backup di repository.
