# Tahap E: pengujian RLS nyata

`rls.test.mjs` adalah harness read-only, opt-in, localhost saja. Belum dijalankan terhadap database. Suite mock default bukan bukti enforcement RLS nyata.

Siapkan Supabase lokal disposable dengan migration 001–006 dan fixtures yang dibuat manual oleh pengelola: dua sekolah aktif, data akademik/kelas/feedback/membership pada kedua sekolah, serta user biasa yang hanya memiliki membership aktif sekolah A. Pastikan fixture B benar-benar ada dengan positive control dari sesi user B; hasil kosong tanpa fixture bukan bukti isolasi.

Inject melalui environment proses CI terisolasi (tanpa dotenv): `RUN_LOCAL_RLS=1`, `RLS_TEST_URL`, `RLS_TEST_PUBLISHABLE_KEY`, `RLS_TEST_USER_ACCESS_TOKEN`, `RLS_TEST_OWN_SCHOOL_ID`, `RLS_TEST_FOREIGN_SCHOOL_ID`. Token harus milik user biasa A, bukan service role. Jalankan `node --test tests/integration/rls.test.mjs`. Jangan log token atau menyimpan credentials di repo. Harness menolak host selain loopback dan tidak melakukan mutation/SQL.

Tahap E masih harus menambahkan dan menjalankan matrix mutation pada database disposable: insert/update/delete sesuai lima role, school column grants/immutable fields, suspended/pending/rejected, cross-tenant FK/ID, RPC activation, stale session, serta role berbeda antar sekolah. Gunakan sesi user biasa; service credentials tidak boleh dipakai untuk assertion RLS. Jangan menjalankan destructive tests pada production. Database provisioning dan perubahan migration tetap memerlukan proses review terpisah.

## Tambahan Tahap B — manual review 007

Draft 007 belum applied, dan harness read-only tahap A tidak menguji trigger audit. Setelah pengelola mereview dan menerapkan 007 pada database disposable, perlu suite transaksi terpisah dengan fixtures untuk:

- direct INSERT audit ditolak (termasuk actor/tenant/timestamp palsu), UPDATE/DELETE/TRUNCATE ditolak; EXECUTE function trigger tidak menjadi API;
- audit SELECT admin A hanya tenant A, kepala sekolah sama, operator/guru/orang tua ditolak;
- semua mutation foundation termasuk default semesters, activate/deactivate siblings, status+role sekaligus dan no-op timestamp;
- gagal insert audit menggagalkan source mutation dalam transaksi yang sama; constraint failure sumber tidak meninggalkan event;
- profile global pada dua active memberships menghasilkan dua event nama field saja; pending/suspended/tanpa active membership tidak diberi tenant audit profil;
- actor normal berasal JWT user biasa, SQL trusted tanpa principal menghasilkan NULL; actor account deletion tidak menghapus/mengubah audit;
- source entity delete meninggalkan logical entity UUID; school deletion tertahan FK RESTRICT;
- metadata tidak mengandung nilai pribadi/password/token/content, dan raw error tidak muncul di Activity;
- capture function owner/search_path/EXECUTE, table grants (termasuk service_role), serta coexistence dengan triggers 001–006.

Jangan menjalankan destructive tests ini di production. Static tests yang lolos tidak membuktikan semantics SQL runtime atau privilege Supabase project aktual. Jangan memakai service-role client untuk assertion RLS yang seharusnya dijalankan sebagai user biasa.
