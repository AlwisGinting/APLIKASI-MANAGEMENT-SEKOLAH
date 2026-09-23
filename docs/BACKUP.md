> **Current status — 2026-09-24:** Owner confirms migrations 001–007 applied in production and immutable. Do not edit or rerun them. Statements below saying 007 (or earlier migrations) is draft/unapplied describe historical work, not current deployment instructions. See [current readiness audit](READINESS-2026-09-24.md) and [Stage C Storage/backup design](STORAGE.md). Live RLS and authenticated smoke testing remain manual gates. No 008, Storage hardening deployment, Drive connection or backup automation was performed in this review.

# Backup dan Pemulihan

Database operasional tetap berada di Supabase PostgreSQL; GitHub bukan tempat backup data sekolah. Aktifkan backup/PITR sesuai paket Supabase, tetapi jangan menganggap Free Plan sebagai jaminan retensi atau availability production.

## Yang perlu dibackup

- Database PostgreSQL melalui export terenkripsi dan terjadwal.
- Supabase Storage melalui prosedur export/replication terpisah untuk bucket private.
- Migration dan source code melalui Git.
- Konfigurasi Auth, redirect URL, dan SMTP sebagai checklist konfigurasi, bukan credential di repository.

Simpan export di lokasi terpisah, terenkripsi, dengan akses terbatas. Jangan membuat backup script yang menulis credential ke repository. Uji restore berkala pada project non-production dan catat RPO/RTO yang disepakati.

Sebelum perubahan migration besar, lakukan backup database dan Storage, verifikasi restore point, review migration, dan siapkan rollback operasional. Migration yang sudah diterapkan bersifat immutable; perubahan berikutnya dibuat sebagai migration append-only.
## Audit trail (Tahap B, migration 007 belum applied)

Setelah 007 diterapkan manual, audit_logs termasuk data database yang perlu masuk backup/restore bersama schema, policies, function owners/grants, dan trigger. Tidak ada backup automation/Storage/Drive integration yang ditambahkan di tahap B. Audit adalah histori mutation setelah penerapan, bukan pengganti backup maupun recovery.

Restore/retention dikerjakan oleh pengelola pada environment terisolasi: audit guard menolak UPDATE/DELETE normal, FK school RESTRICT menahan penghapusan sekolah. Rencanakan urutan restore sekolah dan audit serta verifikasi trigger/privilege setelah restore. Hindari replay audit ganda dari trigger saat restore data bisnis, dan jangan menstempel ulang actor/timestamp historis melalui INSERT biasa; prosedur restore privileged perlu review khusus serta uji pemulihan. UUID actor/entity dapat menunjuk record yang telah dihapus secara sah. Tidak ada prosedur restore SQL yang dijalankan pada tahap ini.


Final 007 tidak memasang BEFORE TRUNCATE trigger. Hak TRUNCATE hanya dicabut dari PUBLIC/anon/authenticated; service_role/owner tidak dicabut untuk browser security. Operasi privileged maintenance/restore berada di luar normal audit trail dan tetap perlu memperhatikan FK, guard UPDATE/DELETE, actor/time stamping, serta replay trigger. Audit trail bukan pengganti database backup. Tidak ada restore, purge, backup automation, atau SQL yang dijalankan.
