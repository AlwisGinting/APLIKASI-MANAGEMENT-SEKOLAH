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

## Status audit foundation 15 September 2026

001–004 sudah applied berdasarkan handoff pemilik; file tidak diubah. 005 belum applied dan tidak dijalankan pada audit ini. Trigger 005 sekarang memaksa status awal `open`, `created_at`, dan `updated_at` dari database saat insert; saat update hanya status dapat berubah dan database menetapkan `updated_at`. Identitas, konten, path, dan waktu pembuatan immutable. Constraint panjang dan RLS tenant/role tetap berlaku.

Migration `202609150006_school_profile.sql` sekarang disiapkan untuk field profil sekolah dan izin edit sekolah oleh super_admin/kepala_sekolah; belum diterapkan. Migration ini tidak bergantung pada tabel feedback, sehingga dapat diterapkan setelah 005 tanpa dependency terhadapnya. Tidak ada migration 007 yang diperlukan pada tahap shell.

006 menambah kolom nullable: alamat, telepon, email, kepala sekolah, NPSN, profil singkat, visi, misi, serta reservasi logo_path. Data sekolah existing tidak diisi/diubah. Constraint panjang dan NPSN memvalidasi nilai non-null. Seluruh migration memakai transaksi; kegagalan validasi akan membatalkan perubahan, bukan menghapus/memperbaiki data otomatis. Kolom, constraint, trigger, dan policy dapat dibuat ulang secara wajar; preflight manual tetap diperlukan bila ada kolom dengan nama sama yang pernah dibuat di luar repository.

Izin UPDATE authenticated dibatasi pada kolom profil. RLS memeriksa role aktif pada school id; operator tidak memperoleh izin edit. Trigger menjaga id/slug/status aktif/created_at/logo_path dan menetapkan updated_at database-side. Trigger ini juga membatasi operasi maintenance pada kolom lifecycle; perubahan lifecycle di masa depan harus dirancang secara eksplisit. Fungsi trigger bukan SECURITY DEFINER. Policy SELECT existing tetap dipertahankan.

Status Tahap A: pemilik mengonfirmasi migration 001–006 sudah applied. Context terpusat kini mensyaratkan kolom 006; schema yang tidak sesuai menghasilkan pesan layanan generik. Empty state tetap tersedia untuk field opsional kosong. Tidak ada SQL yang dijalankan oleh assistant.

Review 005: insert user sendiri pada tenant aktif; select milik sendiri atau admin sekolah; status update oleh super_admin/kepala_sekolah; delete hanya super_admin. Konten/identitas immutable, status awal open dan timestamps dikontrol DB, batas teks 200/5000/1000. Ditambahkan transaksi agar perubahan constraint/policy tidak tersisa parsial. Tidak ada SQL yang dijalankan pada audit ini.


## Status immutable — Core Foundation V2 Tahap A

Migration 001–006 sudah applied menurut konfirmasi pemilik dan tidak diedit pada tahap ini (checksum dibandingkan terhadap working tree awal, bukan HEAD yang memuat pekerjaan lama). Komentar REVIEW ONLY pada 006 adalah riwayat saat draft; file immutable dipertahankan. Tidak dibuat migration 007: active tenant selection, academic context, capability, dan query scoping cukup di application layer. Tidak mengubah policy, grants, trigger, atau Supabase project. Audit RLS berdasarkan source migration; pengujian RLS live belum dilakukan.

## Core Foundation V2 — Tahap B: conventions dan audit (draft 007)

Migration `202609160007_audit_data_integrity.sql` dibuat untuk review manual, **belum dijalankan**. Migration 001–006 tetap applied/immutable menurut konfirmasi pemilik; fingerprint tahap B disimpan di `tests/fixtures/applied-migrations-001-006.json`. Tidak ada migration 008 atau tabel bisnis baru selain audit_logs. Draft memakai transaksi dan sengaja gagal jika nama tabel/function sudah ada, agar schema tak dikenal tidak ditimpa diam-diam.

### Baseline tabel bisnis berikutnya

- UUID primary key dengan default database; identity dan tenant tidak dapat dipindah melalui mutation biasa.
- Data tenant memiliki `school_id NOT NULL`, RLS, policy per operasi, grants minimum, serta index dimulai school_id sesuai pola query. Unique business keys harus mencakup tenant jika domain mengharuskannya.
- Relasi anak–induk tenant memakai composite FK `(school_id, parent_id)` ke unique `(school_id, id)`; validasi application-layer tetap wajib. Setiap FK menyebut perilaku delete secara eksplisit.
- `created_at timestamptz NOT NULL` ditetapkan database; tabel mutable memakai `updated_at` database-controlled. Defaults saja tidak melindungi dari input timestamp: gunakan grants/BEFORE guard. Fields seperti tanggal akademik tetap date sesuai domain.
- CHECK untuk batas panjang, enum/status, range tanggal dan angka; optional text trim/NULLIF sesuai domain. Nama wajib tidak boleh NULL/kosong. Jangan mengubah kapitalisasi/isi bermakna tanpa aturan domain.
- Payload browser bukan authority untuk school_id/user_id/role. Status dan field mutation dibatasi allowlist; invariant penting berada di DB dan audit merekam state yang benar-benar tersimpan.

Ini baseline future, bukan klaim bahwa semua tabel existing sudah memiliki timestamp/identity guard lengkap. 005/006 mengontrol timestamp tertentu; profil/master/membership masih memiliki beberapa timestamp yang disetel Server Action. Tidak dilakukan refactor schema existing hanya demi konsistensi style.

### Delete/archive/lifecycle

| Entity future/existing | Strategi | Perlindungan histori |
|---|---|---|
| students | Archive/nonaktif; workflow keluar/lulus terpisah | Referensi enrollment, absensi, nilai, dan keuangan tetap hidup |
| guardians | Archive identitas/relasi yang berakhir | Relasi historis wali–siswa tidak dihapus massal |
| teachers | Archive/nonaktif | Penugasan dan penanggung jawab historis tetap ada |
| enrollments | Lifecycle aktif/transferred/completed/cancelled | Transfer menutup periode lama dan membuat relasi baru, tidak overwrite histori |
| classrooms | Nonaktif/archive setelah dipakai | Hard delete hanya draft/tidak direferensikan; aturan existing tidak diubah oleh 007 |
| attendance | Koreksi berjejak/void | Catatan operasional tidak hard delete hanya karena siswa nonaktif |
| assessments | Draft boleh hard delete jika aman; published memakai revisi | Nilai yang sudah dipublikasikan memiliki histori koreksi |
| report cards | Draft versus issued/revised/voided | Rapor terbit dipertahankan sebagai versi historis |
| payments | Posted/voided/refunded dengan koreksi tercatat | Transaksi final tidak dihapus/overwrite; rancangan ledger diputuskan saat modul dibuat |
| documents | Lifecycle draft/active/superseded/archived | Metadata dan referensi historis dipertahankan; purge berkas mengikuti retensi yang direview |

Hard delete hanya untuk data draft/keliru yang belum punya dependensi/histori dan diotorisasi. Jangan otomatis cascade histori akademik, finansial, atau absensi ketika induk nonaktif. Archive bukan pengganti workflow atau kebijakan retensi, dan tidak berarti semua data disimpan selamanya. Belum ada implementasi tabel/modul future di atas.

### Desain audit_logs

UUID id; school_id wajib; actor_user_id nullable; action/entity_type text berformat terbatas; entity_id nullable; metadata jsonb object terbatas 8192 byte dengan key allowlist; created_at timestamptz database-controlled. Index `(school_id, created_at DESC, id DESC)` untuk recent timeline dan `(school_id, entity_type, entity_id, created_at DESC)` untuk pencarian histori entity.

`school_id` FK schools ON DELETE RESTRICT: audit tidak ikut cascade hilang ketika sekolah dihapus. Sekolah dengan audit tidak dapat hard-delete tanpa prosedur retensi khusus. `actor_user_id` sengaja referensi UUID historis **tanpa FK**; ON DELETE SET NULL akan mengubah audit append-only, CASCADE menghapus histori, RESTRICT mengikat penghapusan akun selamanya. Nilai actor tetap historical UUID jika user hilang; NULL untuk operasi tanpa auth.uid (sistem/SQL trusted). FK lama lain seperti feedback→profiles tetap dapat membatasi penghapusan akun. `entity_id` juga logical reference tanpa FK agar delete sumber tetap tercatat.

No backfill: audit hanya mencatat mutation setelah 007 diterapkan. Tidak ada updated_at pada audit. Grant hanya SELECT authenticated, dengan RLS active super_admin/kepala_sekolah di tenant terkait. Direct INSERT/UPDATE/DELETE/TRUNCATE tidak diberikan ke public/anon/authenticated/service_role. Audit writer adalah trigger privileged, bukan browser/server API bebas.
