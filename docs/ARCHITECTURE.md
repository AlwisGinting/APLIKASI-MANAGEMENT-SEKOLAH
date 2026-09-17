# Arsitektur

Aplikasi menggunakan Next.js App Router sebagai web application dan PWA-ready shell. Route publik berada di `src/app`; helper Supabase berada di `src/utils/supabase`.

## Batas tanggung jawab

- Browser client memakai publishable/anon key dan hanya mengakses data yang diizinkan RLS.
- Server utilities memakai cookie session Supabase untuk Server Components dan Server Actions.
- Operasi sensitif, seperti persetujuan membership dan perubahan role, harus divalidasi server-side.
- `SUPABASE_SECRET_KEY` hanya boleh dipakai pada server terpercaya, tidak pernah pada Client Component.
- Tenant selalu ditentukan dari `school_id` dan membership `active` pengguna. Migration auth lanjutan mengubah status historis `approved` menjadi `active`.

## Struktur data

`auth.users` adalah sumber identitas Supabase. `profiles` menyimpan profil aplikasi, `schools` menyimpan tenant, dan `school_memberships` menghubungkan user ke banyak sekolah dengan status dan role.

## Auth dan rendering

`src/proxy.ts` mengikuti konvensi Next.js 16 dan memperbarui session cookie melalui `@supabase/ssr` 0.12.7. Proxy bukan authorization gate; helper server memanggil `getUser()` dan memeriksa membership pada setiap request yang dilindungi. `getAuthContext()` memakai React `cache()` untuk deduplikasi dalam satu render, bukan cache global lintas user.

`requireUser()`, `getActiveMembership()`, `requireActiveMembership()`, dan `requireSchoolRole(roles)` menjadi fondasi reusable. Wrapper admin/master memakai role helper yang sama. Pemilihan tenant mempertahankan perilaku existing: membership aktif pertama berdasarkan waktu pembuatan; belum ada tenant switcher.

Recovery melewati callback server, form reset, dan Server Action `updateUser({ password })`. Cookie HttpOnly 15 menit mencatat bahwa browser baru saja menyelesaikan recovery untuk user tersebut. Cookie ini hanya penanda alur UI, bukan credential/otorisasi tambahan: Supabase Auth tetap menentukan apakah user boleh mengganti password dirinya sendiri. Session Auth standar tetap memakai cookie SDK, bukan custom shared-cookie domain.

Halaman auth/private dirender dinamis, fetch backend memakai `no-store`, dan proxy mempertahankan cookie serta header anti-cache SDK. Endpoint health tidak masuk matcher proxy. Timeout 12 detik berlaku per request backend; retry internal SDK dapat menambah durasi total.

## Pembaruan UX auth

Register/login/forgot/reset memakai `<form action={formAction}>` dan `useActionState(serverAction, initialState, permalink)`. HTML hasil server menggunakan POST dan metadata Server Action, sehingga submit tetap mencapai server sebelum hydration/tanpa JavaScript. Seluruh field memiliki name; validasi diulang di server. State `{ success, message, fieldErrors? }` tidak membawa password atau raw provider error.

AuthCard dan AuthForm adalah komponen ringan bersama, tanpa design system baru. Password input uncontrolled; React hanya menyimpan visibility dan boolean indikator panjang. Server Actions register/login/forgot berada di `src/app/auth/form-actions.ts`; reset di route reset-password. Redirect login diletakkan di luar catch agar tidak tertelan.

## Account & app shell

Layout dashboard memiliki sidebar desktop, drawer mobile native dialog, user menu, dan floating feedback native dialog. Halaman baru memakai Server Components; client hanya untuk navigasi interaktif, form action, dan dialog. Menu terpusat di src/config/navigation.ts; UI role filter tetap dilengkapi helper authorization server pada page dan action.

getSchoolContext menggabungkan context auth yang di-cache per render dengan query sekolah dasar/detail paralel. getOwnFeedback memakai user+tenant scope dan maksimal 20 baris. Tidak ada shared cache data user lintas request atau listUsers pada halaman shell. Riwayat aktivitas adalah proyeksi timestamp existing, bukan audit log immutable; notifications adalah ringkasan status, tanpa database notifikasi/read-state/realtime.

Preferensi dashboard memakai cookie HttpOnly non-sensitif school-ui-theme dan school-ui-compact. Layout merender atribut data-theme/data-compact; system dark menggunakan media query CSS, sehingga tidak mengubah markup setelah hydration. Preferensi disimpan hanya untuk browser terkait. Versi UI dibaca dari package.json di Server Component; tidak ada env value/infrastruktur yang ditampilkan.

## Core Foundation V2 — Tahap A (2026-09-16)

`getAuthContext()` memverifikasi `auth.getUser()`, profil sendiri, dan membership milik user. `getTenantOptions()` menyaring status active dan role dikenal, lalu mengambil sekolah aktif dengan kolom eksplisit. `getActiveTenantContext()` menghasilkan user/profile/membership/school/role serta pilihan sekolah valid. Cookie `school-active-tenant` hanya preferensi UUID: setiap request memeriksa kembali ownership/status dari database. Satu sekolah dipilih otomatis; beberapa sekolah memakai pilihan valid, atau fallback deterministik urutan UUID bila cookie hilang/tidak valid. Tanpa kandidat, akses dialihkan ke pending approval. Sekolah nonaktif/hilang juga dikeluarkan.

Switcher Server Action memvalidasi pilihan terhadap daftar tersebut, menyimpan cookie HttpOnly/SameSite=Lax/Secure pada production, menginvalidasi layout, dan redirect tetap `/dashboard`. Tidak ada role/status/context di localStorage. Cookie berlaku antar tab; form lama yang dibuka sebelum switch perlu dimuat ulang. Identifier mutation tetap dibatasi ke tenant aktif request saat submit.

`getAcademicContext()` memakai tenant yang sama: tahun aktif di sekolah tersebut, semester aktif di sekolah dan tahun itu. Tidak ada periode menghasilkan null dan empty state, bukan crash. Orang tua tidak melakukan query akademik sesuai RLS 003. Gangguan layanan menghasilkan pesan generik.

React `cache` hanya deduplikasi render/request: auth, membership, sekolah, dan periode aktif dibagikan layout/page tanpa cache persisten/global. List master tetap query terpisah karena membutuhkan seluruh periode, bukan hanya periode aktif. Proxy masih memverifikasi Auth untuk refresh cookie; verifikasi server diperlukan kembali sebagai boundary request/action.

Authorization terpusat di `src/lib/capabilities.ts` dan `requireCapability()` pada server. Adapter helper lama mengarah ke context yang sama. UI existing dipertahankan; shell hanya menambah pemilih sekolah untuk multi-membership dan label periode. Auth Admin API hanya dipakai halaman admin pengguna untuk lookup email ID hasil query membership tenant, dalam batch maksimal 10 tanpa enumerasi seluruh akun project.

## Tahap B — transactional audit foundation (007 belum applied)

Sumber mutation → guards/RLS existing → AFTER ROW `capture_foundation_audit()` → audit_logs dalam transaksi yang sama. Audit insert gagal berarti mutation rollback; tidak ada fire-and-forget writer atau catch yang mengabaikan kegagalan. Server Actions existing tidak menambah audit insert terpisah. Tahap A context, capability, auth, dan business mutations dipertahankan.

Satu function SECURITY DEFINER diperlukan untuk insert audit tanpa memberi klien privilege INSERT serta melihat membership subject saat profil global berubah. Fixed `search_path=pg_catalog`, semua relasi aplikasi/auth schema-qualified, table allowlist dan validasi TG_SCHEMA/WHEN/LEVEL, tanpa dynamic SQL. EXECUTE dicabut dari PUBLIC/anon/authenticated. Function guard audit biasa (bukan definer) menolak UPDATE/DELETE serta menimpa actor/created_at saat INSERT. Audit tidak memiliki trigger pencatatan dirinya sendiri sehingga tidak rekursif.

Actor berasal `auth.uid()`, bukan approved_by, role form, JWT metadata user, atau cookie. Tenant untuk INSERT dari NEW row yang lolos RLS/guard; UPDATE/DELETE dari OLD row; schools memakai id row. Profil tidak punya school_id: perubahan nama/phone/avatar hanya mencatat nama field yang berubah pada **semua membership active subject**. Tidak memilih membership pertama/cookie, dan tidak menyalin nilai pribadi ke tenant. Jika subject tidak punya membership aktif, tidak dibuat tenant audit profil; audit akun global bukan cakupan tabel ini.

| Sumber | Taxonomy yang disiapkan trigger 007 |
|---|---|
| profiles UPDATE | profile.updated |
| schools UPDATE | school.updated |
| membership UPDATE status | membership.approved / rejected / suspended / updated |
| membership UPDATE role | membership.role_changed; event tambahan jika role dan status berubah bersamaan |
| academic_year INSERT/UPDATE/DELETE | academic_year.created / updated / activated / deactivated / deleted |
| semester INSERT/UPDATE/DELETE | semester.created / updated / activated / deactivated / deleted |
| classroom INSERT/UPDATE/DELETE | classroom.created / updated / deleted |
| feedback INSERT/UPDATE/DELETE | feedback.created / status_changed / deleted |

Perubahan is_active pada UPDATE memilih action activated/deactivated dan tetap mencatat field lain yang berubah. INSERT record yang langsung aktif tetap action created. Timestamp-only/no-op writes diabaikan. Default semester dari trigger 004 ikut tercatat, dalam transaksi tahun ajaran yang sama; urutan tampilan untuk timestamp sama bukan jaminan causal order. Tidak ada audit read/login/password/token/session, profile creation, atau pending membership creation.

Guard existing 001–006 dan trigger Auth/default semester tidak dihapus/diganti. Audit AFTER melihat hasil normalisasi/validasi BEFORE. RPC activation dapat menghasilkan beberapa event untuk aktivasi dan penonaktifan sibling. Kesatuan audit berlaku per transaksi database: Server Action save tahun/semester dan RPC activate existing adalah **dua transaksi**, sehingga kegagalan activation tidak otomatis membatalkan save sebelumnya. Audit tetap benar untuk state yang sudah committed; tidak mengklaim seluruh action atomic.

`getTenantAudit()` menggunakan requireCapability(audit.read), client authenticated normal, tenant filter, kolom eksplisit, limit 50, order created_at/id dan React cache per render. Lookup nama actor memakai profiles/RLS; nama saat ini, bukan snapshot historis. Activity hanya memanggil helper audit untuk super_admin/kepala_sekolah. Role lain tetap melihat ringkasan pribadi. Missing table 42P01/PGRST205 memberi unavailable state; kegagalan lain tidak disamarkan sebagai kosong dan hanya mengirim pesan layanan generik. `audit-format.ts` memformat taxonomy dan metadata melalui allowlist; tidak menampilkan JSON mentah.

Future event student/guardian/teacher/enrollment/attendance/payment dapat memakai pola entity.action tanpa perubahan enum database. Perlu trigger dengan field allowlist serta permission domain yang direview dan label formatter baru; saat ini tidak ada writer/module future yang dibuat.


Final hardening setelah review manual: identity/tenant rewrite tetap ditolak sebelum no-op filter. Tidak ada function reject_audited_truncate atau trigger BEFORE TRUNCATE. Privilege TRUNCATE dicabut hanya dari PUBLIC/anon/authenticated; owner/maintenance berada di luar normal audit trail. service_role tidak disentuh oleh REVOKE. Satu-satunya SECURITY DEFINER tetap capture writer; INSERT stamp menvalidasi schema/table/WHEN/LEVEL selain menetapkan actor dan waktu.

Semantik membership final: status-only menghasilkan satu event status dengan changed_fields=[status] dan old_status/new_status. Role-only menghasilkan satu membership.role_changed dengan changed_fields=[role] dan old_role/new_role. Jika keduanya berubah, dua event tersebut ditulis dalam transaksi yang sama dengan metadata terpisah; status event tidak menyalin perubahan role. Profile adalah global user entity: satu profile update dapat menghasilkan event pada beberapa tenant ACTIVE sekaligus; metadata hanya changed_fields tanpa nilai profil.
