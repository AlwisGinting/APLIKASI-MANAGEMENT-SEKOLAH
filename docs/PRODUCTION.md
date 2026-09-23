> **Auth update — 2026-09-24:** See [combined recovery + Google login review](AUTH-FOUNDATION.md) for current source behavior, required provider/redirect configuration, validation and remaining manual gates. This supersedes older auth-flow descriptions below; no production deployment has been performed.

> **Current status — 2026-09-24:** Owner confirms migrations 001–007 applied in production and immutable. Do not edit or rerun them. Statements below saying 007 (or earlier migrations) is draft/unapplied describe historical work, not current deployment instructions. See [current readiness audit](READINESS-2026-09-24.md) and [Stage C Storage/backup design](STORAGE.md). Live RLS and authenticated smoke testing remain manual gates. No 008, Storage hardening deployment, Drive connection or backup automation was performed in this review.

# Core Foundation V2 — Tahap B: Data Integrity & Audit Trail (final review 2026-09-17)

**Migration 007 hanya draft untuk review manual, belum dijalankan.** Status/hasil tahap A dan audit sebelumnya di bawah adalah riwayat. Seluruh working tree tahap A dipertahankan, dan migration applied 001–006 tidak diedit. Tidak dibuat 008, modul bisnis baru, Storage/Drive/OAuth, backup automation, atau deployment.

- Database conventions: UUID, tenant-owned school_id, timestamptz dengan timestamp DB-controlled, explicit FK delete behavior/constraints, composite tenant FK/index/unique, RLS, normalisasi sesuai domain dan identity protection. Baseline future, tanpa merapikan schema existing hanya untuk style.
- Delete strategy: hard delete draft aman/tanpa dependensi; archive untuk student/guardian/teacher/classroom yang sudah dipakai; lifecycle enrollment, attendance correction, issued assessments/report cards, payments void/reversal, dan documents version/retention. Tidak ada tabel bisnis future dibuat.
- `audit_logs` menyimpan UUID tenant/actor/entity, action/entity taxonomy, metadata terbatas, created_at DB. School FK RESTRICT mencegah cascade histori. Actor/entity sengaja logical historical UUID tanpa FK; user/entity bisa hilang tanpa audit diubah. Actor NULL untuk trusted operation tanpa auth.uid.
- Privilege service_role/owner tidak disentuh; maintenance di luar normal audit trail dan audit bukan pengganti backup. Append-only aplikasi: grants hanya SELECT authenticated dengan RLS active super_admin/kepala_sekolah; public/anon/authenticated tidak diberi direct writes. Guard menolak UPDATE/DELETE dan menstempel actor/time saat INSERT. Owner/superuser DDL tetap di luar jaminan immutability aplikasi.
- Trusted writer: satu AFTER ROW function SECURITY DEFINER, fixed pg_catalog search_path, table allowlist, schema-qualified relations dan EXECUTE dicabut. Definer diperlukan untuk insert audit tanpa hak INSERT browser serta resolusi membership profil global; tidak ada generic browser/API/server audit writer.
- Coverage setelah 007 diterapkan: profile/school update; membership approval/rejection/suspension/role changes; academic year/semester create/update/activate/deactivate/delete; classroom CRUD; feedback create/status/delete. Profile update fanout ke seluruh active memberships subject, hanya nama field; tanpa active membership tidak ada tenant profile event. Tidak audit login/password/token atau read actions. Default semester ikut audit; no-op/timestamp-only diabaikan.
- Event status membership hanya changed_fields=[status] dan old_status/new_status; event role hanya changed_fields=[role] dan old_role/new_role. Status+role menghasilkan dua event tanpa metadata role ganda. Metadata lain tetap hanya changed_fields dan old/new status/role. Tidak ada salinan profil, nilai kontak, isi feedback, password/token/cookie/key/session/raw error stack. Entity UUID tampil sebagai referensi; actor name dibaca melalui profiles RLS pada waktu render, bukan snapshot.
- Audit dan sumber berada dalam transaksi database yang sama; audit failure tidak ditelan. Save+activation Server Action existing tetap dua transaksi, jadi audit atomic per mutation bukan seluruh workflow. Tidak ada backfill histori sebelum penerapan.
- Activity: `activity.read` tetap ringkasan pribadi semua role, `audit.read` hanya admin/kepala sekolah. Query tenant+limit 50 dengan request cache, actor lookup client normal, label action/entity dan safe metadata tanpa JSON mentah. Missing 007 memberi unavailable state; kosong memberi empty state; error lain generik.
- Future taxonomy entity.action dapat diperluas dengan trigger/allowlist/formatter domain setelah review; belum ada student/payment/etc module atau audit writer generik.

Review checkpoint `8e20086` di branch main: working tree awal bersih. Pekerjaan parsial ternyata sudah mencakup helper audit/formatter, capability audit.read, Activity, draft SQL, conventions/archive strategy, dan 63 tes yang lulus. Implementasi application-layer tersebut dipertahankan setelah audit. Dua gap ditutup di draft 007: rewrite id/school_id sumber kini ditolak sebelum filter no-op, dan privilege TRUNCATE application roles dicabut karena tidak menghasilkan row DELETE audit. Sesuai review manual terbaru, seluruh BEFORE TRUNCATE trigger dan REVOKE service_role dihapus; privileged maintenance di luar normal audit trail. Tidak mengubah file 001–006 atau menambah 008.

Validation final: 70 foundation tests LULUS (67 sebelumnya + 3 kontrak statis skenario membership), mencakup identity/TRUNCATE hardening, taxonomy labels, actor lookup failure, render actual audit/empty state/escaping, capability/tenant scope, metadata filtering dan fingerprint migration. Ini static/unit/mock, bukan eksekusi SQL atau production RLS validation. Final hardening pass: lint, typecheck, dan git diff --check LULUS. Build Webpack LULUS pada salinan source identik tanpa file env, memakai Supabase dummy dan izin network untuk Google Fonts; compile, TypeScript, 25 static pages dan route generation selesai. SQL/migration tidak dijalankan. Final checksum 001–006 identik dengan checkpoint dan manifest; tidak ada 008, staged files, commit, push atau deploy. .env/.env.local tidak dibaca.


Manual review wajib sebelum 007: function owner dan default privileges, FK/retention decisions (termasuk sekolah tidak dapat hard-delete ketika punya audit), profile fanout policy, trigger coexistence/default semester/activation, no-op events, source rollback saat audit gagal, multi-role/cross-tenant RLS, direct write/truncate/EXECUTE denial dan metadata di database disposable. Panduan di tests/integration/README.md. Tidak ada integrasi database yang dijalankan.

Batas tersisa: owner/superuser dapat menonaktifkan trigger; belum ada retention/purge/export/pagination (UI recent 50 saja); nama actor dapat berubah/tidak tersedia; profile global tanpa active tenant tidak tercakup; audit bukan backup; multi-step academic action belum atomic seluruh workflow. Tidak mengklaim production audit sudah aktif.

File tahap B: supabase/migrations/202609160007_audit_data_integrity.sql; src/lib/audit.ts, audit-format.ts, capabilities.ts; src/app/dashboard/activity/page.tsx; tests/foundation.test.mjs, fixtures/applied-migrations-001-006.json, integration/README.md; docs/DATABASE.md, ARCHITECTURE.md, SECURITY.md, PRODUCTION.md, BACKUP.md.

---

# Core Foundation V2 — Tahap A: Security & Context (2026-09-16)

Status ini menggantikan catatan historis di bawah. Pemilik mengonfirmasi migration 001–006 sudah applied. Pada tahap A tidak ada migration yang diubah/dijalankan, dan tidak dibuat 007. Working tree lama dipertahankan; diff terhadap HEAD masih mencakup pekerjaan tahap sebelumnya.

- Existing Auth SSR/register/login/recovery, desain shell, master akademik, profil, feedback, dan membership administration dipertahankan.
- Active tenant diselesaikan oleh `getActiveTenantContext()` dari membership sendiri yang active dan sekolah aktif. Cookie hanya UUID pilihan; diverifikasi setiap request. Satu sekolah otomatis, multi-school memakai switcher tervalidasi, cookie stale fallback ke kandidat valid; tanpa kandidat tidak masuk tenant dashboard.
- `getAcademicContext()` memuat tahun aktif sekolah dan semester aktif milik tahun tersebut. Empty state menangani periode yang belum diatur. Orang tua tidak melakukan query akademik.
- Matrix capability di `src/lib/capabilities.ts` sesuai RLS 002–006; detail tabel di SECURITY.md. Guru/orang tua tanpa mutation administratif, operator akademik tanpa delete dan tanpa school.update, feedback.delete hanya super admin.
- Route dashboard, profile, settings (termasuk security/appearance/school), master beserta tiga subroute, users, feedback, activity, notifications, about memakai context/capability terpusat. Informasi sekolah dapat dibaca seluruh active member sesuai RLS; guru/orang tua kini juga dapat membuka school settings read-only.
- Actions school/profile/preferences, academic CRUD, feedback, dan membership administration memeriksa capability pada server. Identifier target difilter tenant; parent academic year diverifikasi; hasil update/delete kosong tidak dianggap sukses. Input role/status pada administrasi user hanya nilai mutation tervalidasi, bukan privilege caller.
- React cache deduplikasi request/render saja, tanpa authenticated global cache. Query sekolah dasar/detail digabung; periode aktif dipakai ulang layout/dashboard. Lookup email Auth Admin dibatasi ke ID hasil membership tenant dengan batch 10, tanpa listUsers seluruh project.
- Shell menambah label sekolah/periode dan switcher hanya ketika lebih dari satu pilihan aktif. Tidak ada modul bisnis baru atau statistik palsu.

Validasi tahap ini: 54 foundation tests (39 sebelumnya, 15 tambahan), lint/typecheck/diff-check. Suite mencakup tenant asing, state membership, cookie invalid, pilihan role multi-school, semester/year scoping, IDOR akademik/feedback/membership, capability restrictions, empty states, dan model deduplikasi/isolasi cache request. Test cache menggunakan model lifetime React; bukan pengujian browser production.

Build dilakukan pada salinan source terisolasi tanpa file env, dengan konfigurasi Supabase dummy dan Webpack (known worker/port issue Turbopack pada environment sebelumnya). Percobaan sandbox gagal mengunduh Google Fonts akibat DNS; build ulang dengan izin network LULUS (compile, TypeScript, 25 static pages, route generation). Tidak mengubah production code untuk mengakali build.

Manual testing yang masih diperlukan: browser dua user/two-school dengan role berbeda, switch dan refresh/back navigation, stale forms pada tab lain (cookie pilihan dibagi antar tab), suspend saat login, periode kosong/aktif, negative mutation semua role, serta RLS langsung dan column grants pada database disposable. Harness read-only localhost tersedia di tests/integration; belum dijalankan dengan database. Tahap E memerlukan fixtures dua tenant dan token user biasa; tidak boleh service-role bypass atau destructive production testing. Guard admin terakhir existing masih application-layer dan belum menjamin race concurrent.

File utama: src/lib/auth.ts, capabilities.ts, academic.ts, school.ts; src/app/dashboard/tenant/actions.ts, layout.tsx, master/actions.ts, settings/actions.ts, feedback/actions.ts; src/app/auth/actions.ts; src/config/navigation.ts; src/utils/supabase/admin.ts; tests/foundation.test.mjs; tests/integration; ARCHITECTURE/SECURITY/DATABASE/PRODUCTION.

Tidak membaca .env/.env.local, menjalankan SQL, mengubah project Supabase, commit, push, atau deploy. Checksum migration dibandingkan terhadap awal tahap A; bukan menghapus diff historis.

---

# Production Readiness

## Status current: Account & App Shell Foundation

Bagian ini adalah hasil lanjutan dari working tree current. Catatan audit auth di bagian bawah merupakan riwayat pekerjaan sebelumnya, bukan status migration terbaru. Auth register/login/recovery dinyatakan normal oleh pemilik dan tidak dirombak pada tahap ini.

### Cakupan yang sudah tersedia dan diselesaikan

| Area | Hasil final |
| --- | --- |
| Existing work | Auth SSR/Server Actions, 31 tes foundation, halaman shell, preference cookie, helper sekolah/profil, serta draft migration 006 sudah ada ketika pekerjaan dilanjutkan. Semua pekerjaan valid dipertahankan. |
| Bagian setengah jadi | Navigasi belum dikelompokkan, mobile masih dropdown kecil, settings/help/quick links belum lengkap, feedback belum graceful saat 005 absen, dokumentasi masih menyatakan 006 belum dibuat, dan validasi build shell belum selesai. |
| Penyelesaian | Navigasi group + native drawer, FAQ/quick links, central navigation/status labels, feedback error/path/submit guard, transaksi 005, idempotency 006, tes tambahan, dokumentasi dan validasi build. |
| Profil | Nama, email, inisial, role, status, sekolah aktif, created/updated. Edit hanya nama/telepon user yang authenticated; tidak ada perubahan email/role/status/tenant dari form. |
| Settings | Hub Profil, Tampilan & preferensi, Keamanan, Profil Sekolah sesuai role, Pemberitahuan, Tentang, dan Bantuan. |
| Appearance | System/light/dark + mode ringkas. Cookie browser non-sensitif, SSR data attributes, system theme via CSS. Bahasa Indonesia. Tidak ada tabel preference atau pembacaan localStorage saat render. |
| Keamanan | Email verification status, password baru + current_password + confirmation, logout local, serta logout global dengan konfirmasi. Normal Supabase user flow, tanpa admin client. Current-password/reauth policy provider dan expiry akses setelah global logout perlu diverifikasi manual. |
| Sekolah | Data aktual dari sekolah membership aktif. Admin/kepala sekolah edit setelah 006; operator hanya baca. Guru/orang tua dapat membaca informasi publik-dalam-tenant melalui Tentang/Bantuan, bukan route school settings. Slug/id/status/lifecycle tidak dapat diubah form. |
| About/help | Data sekolah aktual; kosong = Belum diisi. FAQ daftar/login/verifikasi/pending/password/profil/feedback/kontak. Nama aplikasi, versi package.json, label lingkungan aman, Next.js/Supabase tanpa detail infra. |
| Activity | Timestamp akun dibuat/login terakhir/profil diperbarui/persetujuan membership dan maksimal 20 feedback milik user pada tenant aktif. Bukan audit trail immutable; tidak ada event password atau riwayat perubahan yang dikarang. |
| Notifications | Ringkasan membership aktif dan feedback resolved/closed dari 20 feedback terbaru. Tidak ada unread count, realtime, tabel notifikasi, atau system notice palsu. |
| Dashboard/navigation | Greeting, profil/role/sekolah/periode aktif; tanpa statistik bisnis palsu. Quick links termasuk Master Data sesuai role. Sidebar desktop dan group Dashboard/Akademik/Administrasi/Akun/Bantuan. Drawer mobile dan user menu. |
| Avatar/logo | Tetap inisial. Upload tidak diaktifkan karena Storage existing masih terlalu luas untuk kepemilikan avatar/logo. Tidak ada URL storage mentah yang dipasang sebagai gambar. |
| Migration 005 | Belum applied. Static review lulus untuk tenant aktif, own insert/select, admin select/status update, superadmin delete, immutable content, status awal open dan timestamps DB-controlled. Transaksi ditambahkan untuk menghindari perubahan parsial. |
| Migration 006 | Belum applied. Kolom nullable tidak mengubah data sekolah existing. Constraint/trigger/policy dapat dibuat ulang; transaksi rollback bila validasi gagal. RLS/grants admin-only dengan column allowlist. Tidak ada SECURITY DEFINER baru, tidak bergantung pada feedback. Tidak dibuat 007. |
| Authorization | Layout/page/action tetap memeriksa membership/role server-side. user_id dan school_id berasal dari context authenticated. Direct school profile RLS harus diuji setelah penerapan manual 006. |
| Performance | Auth/profile/membership/school di-cache hanya dalam render. Query sekolah dasar/detail paralel; feedback bounded dan user+tenant scoped. Tidak menambah listUsers, select *, N+1, atau client data-fetch loop. |
| Mobile/accessibility | Native dialog untuk drawer/feedback: Escape, focus containment, background inert, fokus kembali ke trigger. Label/aria-current/live error, focus-visible, skip link, input/tombol nyaman, padding bawah melindungi action dari floating feedback. Settings tidak berupa satu form raksasa. |
| Next.js | Next terpasang 16.3.4: src/proxy.ts benar menggantikan middleware.ts. Root/dashboard error, dashboard loading, not-found tetap ada. Semua route dashboard dinamis menurut build. |
| Batas penerimaan | Belum menguji browser visual/keyboard nyata dengan akun dua tenant pada tahap lanjutan ini; tidak mengakses env atau menjalankan SQL. Review DB, policy hukum, dan acceptance manual masih diperlukan. |

### Routes final

Route shell baru: `/dashboard/profile`, `/dashboard/settings`, `/dashboard/settings/appearance`, `/dashboard/settings/security`, `/dashboard/settings/school`, `/dashboard/about`, `/dashboard/help`, `/dashboard/activity`, `/dashboard/notifications`, `/privacy`, `/terms`. `/dashboard`, master data, pengguna, dan feedback existing tetap tersedia sesuai role.

### Validasi final

- `npm run lint`: lulus tanpa warning.
- `npm run typecheck`: lulus.
- `npm run test:foundation`: 35 tes lulus, termasuk auth existing, own-profile, school authorization/allowlist, cookie preference, logout scope, missing schema, navigasi role, sanitasi path feedback, dan update tanpa row.
- `npm run build`: gagal karena larangan port worker Turbopack (`Operation not permitted`), termasuk percobaan izin tambahan.
- `npm run build -- --webpack`: lulus; default script build tidak diubah.
- `git diff --check`: lulus.
- 001–004 identik terhadap HEAD; env tidak staged; pemeriksaan 49 browser JS files tidak menemukan referensi SUPABASE_SECRET_KEY. Pemeriksaan source tidak menemukan prefix hardcoded secret key. Ini pemeriksaan statis, bukan pembandingan nilai env.
- Tidak ada reset/restore/clean/stash, commit, push, deploy, atau SQL/migration yang dijalankan. Next build memuat env secara internal; isinya tidak dibaca/ditampilkan oleh audit.

### File utama dan review manual

Implementasi shell: `src/app/dashboard/{profile,settings,about,help,activity,notifications}`, dashboard layout/home, `src/components/dashboard`, `src/config/{app,navigation}.ts`, `src/lib/{school,settings,shell,feedback}.ts`, globals.css dan feedback modal/actions/page. Form auth existing dipertahankan. Header/min-height halaman master/users disesuaikan dengan shared shell; business actions master tidak diubah.

Review manual khusus:

- `supabase/migrations/202609110005_feedback.sql`: policy, trigger immutability, constraint, transaksi, dan hasil pada environment uji.
- `supabase/migrations/202609150006_school_profile.sql`: kolom existing yang mungkin dibuat di luar repo, constraint/grants/RLS, serta trigger yang memblokir perubahan lifecycle termasuk maintenance. Jangan menjalankan tanpa review.
- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`: draf saja, harus direview pemilik sebelum production formal.
- `src/app/dashboard/settings/actions.ts`: acceptance password policy/reauth dan logout scope pada konfigurasi Auth aktual.
- `src/components/dashboard/navigation.tsx`, settings-form, feedback-button dan globals.css: keyboard/mobile/dark-mode acceptance.

### Langkah manual berikutnya

1. Login akun active. Buka seluruh route di atas. Pending/rejected/suspended tetap ditolak dari dashboard. Coba direct URL Pengguna/School Settings dengan role tidak berizin; pesan unauthorized harus tampil, bukan hanya menu tersembunyi.
2. Profil: ubah nama/telepon milik sendiri; kosongkan nama atau masukkan telepon invalid; coba user_id/school_id/role tambahan melalui request test. Hanya profil user server boleh berubah. Header/inisial harus ikut berubah setelah simpan.
3. Settings: simpan system/light/dark, refresh, lalu ubah preferensi OS pada mode system. Tidak boleh hydration warning/flash markup berbeda. Browser lain boleh punya tema berbeda. Coba compact dan nama sekolah/user panjang pada layar 320px/390px/desktop.
4. Keamanan: current password salah, password baru pendek/mismatch, perubahan valid; lihat status verified. Uji logout local tidak memutus browser lain. Logout semua sesi membutuhkan centang; akses yang sudah terbit bisa bertahan sampai expiry. Jangan menyimpan token/log session sebagai bukti tes.
5. Sebelum penerapan 005/006: About menampilkan data dasar + Belum diisi, edit sekolah belum aktif, feedback menampilkan pesan belum tersedia, activity/notifications tidak mengarang event.
6. Setelah pemilik mereview migration dan menerapkannya secara manual pada environment uji: super_admin/kepala sekolah bisa edit sekolah sendiri, operator tidak bisa edit, tenant lain tidak berubah. Uji payload id/slug/is_active/logo_path/updated_at, batas field/NPSN, dan RLS langsung. Verifikasi created data sekolah lama tetap utuh.
7. Uji 005 langsung di lingkungan uji: own insert tenant aktif, wrong user/tenant ditolak, konten immutable, hanya role berhak mengubah status/menghapus, initial status/timestamps dari DB. Status update id tidak ditemukan/lintas tenant tidak boleh melaporkan sukses.
8. Navigasi/feedback: Tab dan Shift+Tab, Escape, fokus kembali ke trigger, sidebar saat resize ke desktop, dialog tidak overflow, floating button tidak menutup form action. Klik Kirim dua kali hanya satu proses UI. current_path tidak menyimpan query/fragment.
9. Activity/notifications harus cocok dengan data existing; tidak ada klaim riwayat password atau jumlah belum dibaca. Tentang/Bantuan hanya menampilkan data resmi yang benar-benar diisi.
10. Jalankan default build pada host yang mengizinkan worker Turbopack. Review dokumen privasi/syarat dan putuskan kebijakan Storage/avatar serta invariant admin terakhir pada fase berikutnya; jangan membuat modul bisnis sebelum shell diterima.

## Riwayat audit foundation sebelumnya

## Arsitektur runtime

Frontend berjalan di Vercel melalui Next.js App Router. Auth, PostgreSQL, RLS, dan Storage berjalan di Supabase. Browser memakai publishable key; server memakai cookie-based Supabase SSR client. Secret key hanya untuk operasi Admin Auth yang memang diperlukan.

## Dependency dan failure points

- Vercel atau domain/DNS bermasalah dapat membuat frontend tidak tersedia.
- Supabase paused, network timeout, Auth, database, atau Storage bermasalah dapat membuat fitur dinamis gagal.
- SMTP/Auth redirect yang salah dapat mengganggu verification dan password recovery.
- `/api/health` hanya menyatakan proses aplikasi hidup, bukan jaminan database tersedia.

Halaman dashboard memiliki loading/error boundary dengan pesan generik. Jangan menambahkan fake traffic atau keep-alive untuk menghindari aturan inactivity provider. Kebutuhan availability production perlu dievaluasi terhadap plan/platform yang sesuai.

## Checklist production

- Domain production dan HTTPS aktif.
- Environment Vercel memakai URL dan publishable key dari Supabase project yang sama dengan local.
- Secret key hanya di server environment.
- Supabase Site URL dan Redirect URLs sudah benar.
- Custom SMTP production aktif dan diuji.
- DNS custom domain telah diverifikasi bila digunakan.
- Migration diterapkan manual setelah review dan backup.
- Redeploy dilakukan setelah environment berubah.
- Backup database dan Storage diuji, dengan prosedur restore terdokumentasi.

Local `http://localhost:3000` dan production dapat berjalan berdampingan; session cookie keduanya memang terpisah berdasarkan origin.
## Hasil audit repository — 15 September 2026

### Git dan pekerjaan existing

Awal: `main...origin/main`, HEAD `2b59fa8` (`feat: add academic master data and feedback system`), tanpa commit setelah checkpoint tersebut. Terdapat 10 file tracked modified dan 8 entri untracked pada status awal.

Perubahan existing dipertahankan dan dilanjutkan: README, DEPLOYMENT, SECURITY, security headers next.config, script check package.json, konfigurasi feedback/password, tampilan pending/reset/register, serta helper auth. File untracked existing yang dipertahankan: `.env.example`, BACKUP, PRODUCTION, endpoint health, dashboard error/loading, config aplikasi, dan kategori error. Tidak ada reset/restore/stash/clean, commit, push, deploy, atau operasi SQL.

### Temuan dan perubahan

| Area | Hasil |
| --- | --- |
| Reset password | Sebelumnya email mengarah langsung ke halaman client, form selalu aktif tanpa pemeriksaan sesi recovery, dan sukses tidak mengakhiri sesi. SDK dapat melakukan auto-exchange, tetapi aplikasi tidak menangani lifecycle/error recovery secara eksplisit. Ini kelemahan kode yang terverifikasi; penyebab persis kegagalan email production belum dapat dipastikan tanpa uji environment/email. |
| Flow final | Forgot → email PKCE → callback server exchange → event PASSWORD_RECOVERY → marker HttpOnly 15 menit → reset server page memverifikasi user → form/confirmation → Server Action memverifikasi user lagi dan updateUser → hapus marker serta cookie sesi lokal → sukses → login. URL reset lama dengan query code diteruskan ke callback. |
| Invalid/expired/session hilang | Form tidak tersedia, pesan generik dan link permintaan baru; kegagalan backend tidak mengungkap detail Supabase. UI dan Server Action memvalidasi minimum 8 karakter/confirmation, tombol pending dan guard ref menghindari double-submit dari form. |
| Local vs production | Source memakai runtime origin, tanpa hardcoded localhost pada flow. Nilai local/Vercel/Supabase dashboard tidak diperiksa. Project mismatch, env build lama, SMTP/template, redirect allowlist, dan status membership masih perlu diverifikasi manual. Password akun yang sama berlaku jika project Auth sama; cookie tiap origin terpisah. |
| SSR/session | Versi terpasang Next 16.3.4, SSR 0.12.7, supabase-js 2.116.0. Konvensi middleware dipindah ke src/proxy.ts. getAll/setAll dan header anti-cache SDK dipertahankan termasuk saat beberapa cookie writes. Tidak memakai auth-helpers legacy. |
| Authorization | requireUser/getActiveMembership/requireActiveMembership/requireSchoolRole tersedia; wrapper admin/master memakai helper role. Export MEMBERSHIP_STATUSES yang terputus dipulihkan. Tenant dari membership server; pending/rejected/suspended tidak dapat dashboard. Status pending UI berasal dari database. |
| Tenant/RLS | Query tenant dan master roles konsisten dengan migration 003. Orang tua tidak mendapat master access; guru read-only; operator tidak boleh delete. RLS static audit, bukan pengujian database live. Batas membership/Storage ada di SECURITY. |
| Cache | React cache hanya deduplikasi render. Halaman auth/private dinamis; backend fetch no-store; response cookie tidak boleh masuk shared cache. Build Webpack mengonfirmasi route auth/dashboard dinamis. |
| Performance | Query auth/profile/membership layout/page dideduplikasi; query profil batch, tidak ditemukan select('*') pada source aplikasi. Set mempercepat pencocokan hasil lookup email. listUsers masih memindai halaman user global server-side untuk mendapatkan email tenant; tidak diganti dengan N+1 getUserById. Ini batas skalabilitas yang perlu solusi query terotorisasi sebelum tenant besar. List existing belum memiliki pagination eksplisit. |
| Error/availability | Root route error boundary melindungi kegagalan dashboard layout, dashboard boundary memakai retry sesuai Next terpasang, halaman not-found ditambahkan. Query gagal tidak lagi terlihat sebagai daftar kosong. Fetch timeout 12 detik per request; retry SDK bisa memperpanjang total waktu. |
| Health | GET /api/health → {"status":"ok"}, no-store, tidak menghubungi database/Auth dan tidak masuk matcher proxy. |
| Security | Safe internal redirect termasuk backslash/encoded bypass; callback no-referrer; secret client server-only. Pemeriksaan bundle hanya mencari referensi nama secret, bukan membaca/membandingkan nilai secret. Penanda recovery hanya kontrol flow UI, bukan pengganti Supabase authorization. |
| Migration 005 | Static audit: id/user/school/content/type/path/created_at immutable; updated_at database-controlled; anggota aktif wajib; admin/kepala update status, hanya super admin delete; batas teks 200/5000/1000. Bug insert diperbaiki: status dipaksa open dan timestamps ditetapkan database. Belum diterapkan. |
| Migration 006 | Tidak diperlukan untuk perubahan auth/feedback ini. Diperlukan untuk menegakkan kebijakan tambahan membership admin terakhir/Storage setelah kebijakan disepakati. Tidak dibuat karena aturan tersebut ambigu dan mengubah perilaku existing. |
| Dependency hygiene | Tidak ada upgrade dependency/major atau perubahan lockfile. npm ls mencatat beberapa paket WASM opsional extraneous pada instalasi lokal; tidak dihapus otomatis. Belum ada hasil audit CVE registry dalam pekerjaan ini. |

### File baru dan file berubah

File yang dibuat pada audit ini:

- `src/proxy.ts` (pengganti `middleware.ts`)
- `src/lib/redirect.ts`, `src/lib/recovery.ts`
- `src/utils/supabase/fetch.ts`
- `src/app/error.tsx`, `src/app/not-found.tsx`
- `src/app/reset-password/actions.ts`, `src/app/reset-password/reset-form.tsx`
- `tests/foundation.test.mjs`

File yang diubah/dilanjutkan pada audit ini:

- `README.md`, `package.json`
- `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION.md`, `docs/ROADMAP.md`, `docs/SECURITY.md`
- `src/lib/auth.ts`, `src/lib/errors.ts`
- `src/utils/supabase/admin.ts`, `src/utils/supabase/client.ts`, `src/utils/supabase/server.ts`
- `src/app/auth/actions.ts`, `src/app/auth/callback/route.ts`
- `src/app/login/page.tsx`, `src/app/login/login-form.tsx`
- `src/app/register/page.tsx`, `src/app/register/register-form.tsx`
- `src/app/forgot-password/page.tsx`, `src/app/forgot-password/forgot-form.tsx`
- `src/app/reset-password/page.tsx`, `src/app/pending-approval/page.tsx`
- `src/app/dashboard/error.tsx`, `src/app/dashboard/users/page.tsx`, `src/app/dashboard/feedback/page.tsx`
- `src/app/dashboard/master/academic-years/page.tsx`, `src/app/dashboard/master/semesters/page.tsx`, `src/app/dashboard/master/classrooms/page.tsx`
- `supabase/migrations/202609110005_feedback.sql`

`middleware.ts` dipindahkan/digantikan, bukan dihapus fungsinya. Perubahan existing lain tetap berada di working tree: `next.config.ts`, feedback actions, config, health, loading, BACKUP, dan `.env.example`.

### Validasi otomatis

- `npm run lint`: lulus.
- `npm run typecheck`: lulus.
- `npm run test:foundation`: 14 tes lulus, tanpa jaringan/database. Meliputi redirect berbahaya, callback recovery/verification/error, validasi reset/session, cleanup cookie, sanitasi fetch, health, dan cookie/header proxy. Satu tes menggunakan implementasi SSR terpasang dengan transport mock untuk memverifikasi event recovery.
- `npm run build`: gagal karena sandbox/host melarang port lokal yang diperlukan Turbopack (`Operation not permitted`), termasuk percobaan dengan izin tambahan.
- `npm run check`: lint dan typecheck lulus; gagal di tahap build dengan pembatasan Turbopack yang sama.
- `npm run build -- --webpack`: lulus sebagai build pembanding; script build default tidak diubah.
- `git diff --check`: lulus.
- Tidak membaca isi file env. Next build memuat `.env.local` secara internal sesuai mekanisme framework; nilai tidak dicetak/diperiksa.

### Pengujian manual sebelum public release

1. Cocokkan project Supabase local dan Vercel, env target Production/Preview, waktu deployment terakhir, Site URL, allowed redirects (termasuk query callback recovery), email confirmation, dan template ConfirmationURL; jangan menyalin nilai rahasia ke laporan.
2. Uji register → verification → login dengan user existing/test yang diizinkan; pastikan akun baru pending dan tidak otomatis memiliki role. Jangan membuat akun duplikat untuk mengatasi mismatch.
3. Forgot dengan email terdaftar/tidak terdaftar harus menghasilkan pesan UI yang sama. Buka email pada browser/origin yang meminta recovery; isi password minimal 8 karakter dan confirmation sama; klik dua kali; pastikan satu proses UI, sukses terlihat, lalu login memakai password baru. Password lama harus ditolak.
4. Uji link tidak valid, expired, dipakai ulang, tanpa code, browser berbeda/incognito, cookie hilang, serta akses langsung reset saat signed-out dan saat login biasa. Form reset harus tertutup tanpa konteks recovery. Refresh halaman pada recovery valid tetap boleh sebelum batas waktunya.
5. Uji callback `next` berupa `/`, `/dashboard`, `/reset-password`, URL eksternal, `//host`, backslash, dan encoding. Tidak boleh redirect ke origin luar.
6. Uji login/reset pada local dan production untuk akun/project yang sama. Pastikan logout serta reset membersihkan sesi browser yang bersangkutan; jangan mengharapkan cookie lintas origin.
7. Uji dua tenant dengan role super_admin/kepala_sekolah/operator/guru/orang_tua dan pending/rejected/suspended. Uji URL langsung, Server Actions, serta RLS database langsung pada lingkungan uji. Ganti id record/school_id/user_id; akses lintas tenant harus ditolak. Tidak ada uji SQL yang dijalankan pada audit ini.
8. Setelah 005 diterapkan manual oleh pemilik, uji insert status/timestamp palsu, perubahan konten/identitas, update status oleh nonadmin, delete oleh nonsuperadmin, dan panjang teks berlebih. Verifikasi semua pembatasan langsung pada RLS/trigger lingkungan uji.
9. Simulasikan backend unavailable/offline/timeout: pesan generik, form tidak terus loading, query gagal tidak menampilkan seolah data kosong, health tetap app-level. Periksa response auth/private no-store dan Set-Cookie di local serta deployment; jangan menyimpan token dalam catatan pengujian.
10. Jalankan build Turbopack default pada host/CI yang mengizinkan worker/port lokal. Uji UI browser nyata termasuk tombol retry boundary, lalu verifikasi SMTP delivery, backup/restore, dan kebijakan membership/Storage sebelum menerima data sensitif.

Status: perbaikan kode dan build pembanding selesai. End-to-end email, RLS live, konfigurasi production, dan build default pada host yang mendukung masih menjadi release gate; belum dinyatakan production-ready penuh.

## Audit lanjutan: AUTH FOUNDATION dan UX

Bagian ini memperbarui implementasi form pada audit awal di atas. Perubahan awal tetap dipertahankan; tidak ada SQL/migration, akun baru, commit, push, atau deploy yang dilakukan.

### Akar GET /register

Form sebelumnya hanya memiliki onSubmit client, tanpa action/method dan tanpa name input. Jika handler belum terpasang karena hydration/JavaScript tidak aktif, perilaku HTML default adalah GET ke halaman yang sama dengan query kosong. Tidak ada nested form atau button type salah. Penyebab pasti JavaScript/HMR tidak aktif di browser pemilik belum dapat dibuktikan dari source; bug fondasi form yang membuat kegagalan ini menjadi GET telah diperbaiki.

Form sekarang terhubung ke registerAction melalui useActionState. Field full_name/email/password/confirmation bernama, default HTML hasil React adalah POST multipart dengan metadata Server Action. Native POST tanpa JavaScript telah diuji pada server development project yang sudah berjalan di localhost:3000: respons menampilkan validasi server dan aria-invalid. Input sengaja invalid sehingga signup tidak dipanggil pada tes HTTP. Signup valid diuji dengan mock client, bukan membuat user live.

### Flow dan UX final

Register → validasi client opsional → POST Server Action → validasi server → signUp publishable SSR → simpan cookie PKCE → success → verification email → callback → dashboard/pending sesuai membership. Register verification memakai Origin request yang cocok dengan host + `/auth/callback?next=/dashboard`. Forgot memakai pola sama menuju `/auth/callback?next=/reset-password`.

AuthCard/AuthForm menyamakan lebar card, spacing, kontras label, tinggi input/tombol minimal 48px, mobile viewport, serta alignment desktop. Password dapat ditampilkan/disembunyikan; indikator panjang dan validasi confirmation tersedia. Password tidak disimpan di React state, hasil action, atau log. Tombol pending/fieldset disabled dan ref guard mencegah submit ganda dari UI. Server tetap memvalidasi request ulang; tidak mengklaim idempotensi lintas tab/request.

Semua input memiliki label dan autocomplete yang sesuai. Error field dihubungkan lewat aria-describedby/aria-invalid; ring fokus jelas; kesalahan submit client memindahkan fokus ke field pertama yang salah. Alert memakai live region dan semantic status/alert. Show/hide adalah button type=button dengan aria-pressed dan label spesifik. Enter submit menggunakan form native. Tidak ada dialog/modal baru.

### Error mapping dan security

- Validasi: fieldErrors Bahasa Indonesia untuk nama/email/password/confirmation.
- Login: kredensial salah, user tidak ditemukan, dan email belum verified memiliki pesan yang sama. UI tidak memberi tahu keberadaan akun.
- Forgot: permintaan diterima, unknown user, dan Auth 4xx/rate-limit memiliki success generik yang sama: “Jika email terdaftar, tautan pemulihan akan dikirim.” Gangguan jaringan/5xx menggunakan pesan layanan generik.
- Register: kegagalan provider menjadi pesan pendaftaran generik; rate-limit menjadi pesan tunggu. Tidak merender raw Supabase error.
- Reset: validasi server/sesi tetap dipertahankan; error update dipetakan; sukses membersihkan sesi lokal dan mengarahkan ke login.
- Origin untuk email callback dibentuk server-side, divalidasi terhadap host, tanpa menerima origin/user_id/school_id dari form sebagai authority.
- Secret admin client tidak dipakai auth mutation. Safe internal redirect existing tetap dipertahankan.
- Diagnostic register hanya development. Pesan log error memakai mapping aman, bukan raw error.message karena dapat mengandung identifier pengguna.

### File yang berubah pada tahap ini

Baru: `src/app/auth/form-actions.ts`, `src/lib/auth-form.ts`, `src/lib/auth-origin.ts`, `src/components/auth/auth-card.tsx`, `src/components/auth/auth-form.tsx`, `tests/auth-post-smoke.mjs`.

Diubah: `src/app/register/page.tsx`, `src/app/register/register-form.tsx`, `src/app/login/page.tsx`, `src/app/login/login-form.tsx`, `src/app/forgot-password/page.tsx`, `src/app/forgot-password/forgot-form.tsx`, `src/app/reset-password/actions.ts`, `src/app/reset-password/reset-form.tsx`, `next.config.ts`, `package.json`, `tests/foundation.test.mjs`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, dan `docs/PRODUCTION.md`.

### Validasi tahap UX

- Lint, typecheck, diff-check: lulus.
- Foundation regression: 21 tes lulus (termasuk validasi register, panggilan signup, origin local/LAN/production, sanitasi diagnostic, mapping login dan forgot).
- Native HTTP smoke: lulus pada localhost:3000 tanpa menjalankan JavaScript, membuktikan POST Server Action dan error accessible.
- Build default Turbopack: terhambat larangan port lokal, termasuk percobaan izin tambahan.
- Build Webpack pembanding: lulus; script build default tetap dipertahankan.
- `npm run check` tidak diulang pada tahap ini karena pasti melewati build default dengan pembatasan yang sudah direproduksi; lint/typecheck dijalankan terpisah.
- UI browser visual/keyboard dan email live belum diuji otomatis; browser automation tidak terpasang. Tidak membaca isi env. Next memuat environment secara internal saat build/dev.

### Langkah manual yang harus dijalankan

1. Restart `npm run dev`, buka `/register` dari localhost atau `http://10.10.33.202:3000`. Aktifkan Network “Preserve log”. Gunakan Tab/Shift+Tab dan viewport 320px/390px/desktop; pastikan tidak overflow dan semua fokus terlihat. Untuk LAN, periksa WS setelah reload; allowlist hanya mengatasi blok cross-origin development, bukan firewall/proxy.
2. Register: kirim kosong/email invalid; password `1234567`; lalu password 8+ dengan confirmation berbeda. Harus muncul error dekat field dan summary. Toggle show/hide tidak boleh submit; Enter pada input harus submit. Validasi invalid tidak boleh membuat akun.
3. Register valid: gunakan alamat email uji yang Anda kuasai dan belum terdaftar (jangan membuat duplikat sebagai workaround). Isi nama, email, password 8+, confirmation sama. Klik Daftar dua kali: tombol loading/disabled. Browser harus menunjukkan POST /register; terminal development `[auth.register] action invoked`, lalu `signup accepted` atau error yang aman. Jangan mengharapkan browser memanggil Supabase langsung karena signup kini server-side.
4. Pada Supabase Authentication > Users, periksa apakah email uji muncul. Periksa inbox/spam, klik verification dari browser yang sama. Jika user tidak muncul, gunakan kode/status diagnostic untuk memeriksa konfigurasi Auth/trigger tanpa menyalin email/password/key ke laporan. Bila konfirmasi aktif, pastikan tidak mendapat akses dashboard sebelum verification dan approval.
5. Login: coba password salah dan akun belum verified; keduanya harus mendapat pesan generik yang sama. Akun verified pending harus menuju pending-approval, akun active menuju dashboard. Coba Enter, show/hide, logout, lalu login ulang.
6. Forgot: kirim email existing, lalu email random valid pada sesi/halaman baru. Keduanya menampilkan “Jika email terdaftar, tautan pemulihan akan dikirim.” Klik ganda tidak menggandakan proses UI. Periksa loading selesai saat gangguan jaringan.
7. Reset: minta link baru, buka di browser/origin yang sama. Coba password pendek, mismatch, kemudian password baru yang valid. Periksa show/hide, loading, success, redirect login. Login dengan password baru harus berhasil, password lama ditolak.
8. Reset negatif: expired/reused/invalid link, cookie/session hilang, dan akses langsung reset tanpa recovery. Tampilkan pesan aman serta link permintaan baru; tidak boleh membuka form tanpa konteks recovery.
9. Untuk mengulang tes HTTP tanpa signup: saat dev server lokal aktif jalankan `npm run test:auth-http -- http://localhost:3000`. Tes hanya mengirim isian invalid dan tidak menjalankan kode JavaScript browser.
10. Ulangi email verification/recovery pada domain production dengan checklist DEPLOYMENT setelah perubahan di-deploy oleh Anda. Pastikan project Auth/env yang sama, allowed redirects tepat, dan cookie local/production tetap terpisah.
