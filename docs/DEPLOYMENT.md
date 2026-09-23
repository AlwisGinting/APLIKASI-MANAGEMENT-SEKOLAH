# Deployment

Project ini melanjutkan deployment dan Supabase yang sudah ada. Jangan membuat project/akun pengganti untuk memperbaiki login.

## Status database saat handoff

- Migration 001–004 sudah diterapkan; 004 dikonfirmasi sukses oleh pemilik project. Jangan edit atau jalankan ulang migration tersebut.
- `202609110005_feedback.sql` belum diterapkan. File sudah ditinjau secara statis; penerapan hanya secara manual setelah review dan backup.
- `202609150006_school_profile.sql` juga belum diterapkan; review field/constraints/grants dan trigger lifecycle sebelum penerapan manual. Tidak bergantung pada feedback 005.
- Jangan menjalankan seed pada database existing sebagai bagian dari deployment rutin. File seed repository berada di `supabase/migrations/seed.sql`.
- Audit ini tidak menjalankan SQL, mengubah dashboard Supabase, commit, push, atau deploy.

Sebelum deployment berikutnya, selesaikan checklist di bawah, jalankan pemeriksaan README, dan tinjau [batas kesiapan production](PRODUCTION.md). Environment yang berubah memerlukan build/deployment baru; terutama `NEXT_PUBLIC_*` terikat pada build browser.

## Environment checklist

Local `.env.local` dan Vercel harus memakai tiga nama variable yang sama:

- `NEXT_PUBLIC_SUPABASE_URL` - URL project Supabase yang sama.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - publishable key dari project tersebut.
- `SUPABASE_SECRET_KEY` - server-only secret key dari project tersebut.

Jangan menyalin value antar project atau membuat akun kedua sebagai workaround. Jika URL project berbeda, akun Auth memang tidak dibagikan antar project. Setelah memperbaiki environment Vercel, lakukan redeploy agar runtime memakai value baru.

## Checklist local + public application

Localhost dan Vercel harus menunjuk ke project Supabase yang sama. Nilai tidak perlu dibagikan antar origin: browser memang menyimpan cookie session yang berbeda, tetapi `auth.users`, `profiles`, `school_memberships`, dan role tetap berasal dari database yang sama.

- Local `.env.local` dan Vercel Production memakai nama `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY`.
- Vercel Production harus memakai URL project yang sama dengan local. Periksa nama variable dan target environment di Vercel tanpa menyalin nilainya ke chat atau repository.
- Deployment Vercel harus berasal dari source terbaru yang disetujui, minimal commit `654a906` untuk Google foundation atau commit lanjutan yang memuat perbaikannya. Cocokkan deployment commit SHA di Vercel, bukan hanya branch name.
- Supabase **Authentication → URL Configuration → Site URL**: `https://aplikasi-management-sekolah.vercel.app`.
- Supabase Redirect URLs harus memuat callback production dan localhost, termasuk pola `next=/dashboard`, `next=/reset-password`, `flow=google`, dan `sb_flow_id=*`. Gunakan daftar lengkap di [AUTH-FOUNDATION.md](AUTH-FOUNDATION.md); jangan menambah wildcard domain umum.
- Supabase **Authentication → Providers → Google** harus enabled dan memakai provider yang sama untuk kedua origin.
- Google Cloud Authorized JavaScript origins: `https://aplikasi-management-sekolah.vercel.app` dan `http://localhost:3000`.
- Google Cloud Authorized redirect URI harus disalin persis dari Supabase **Authentication → Providers → Google**, berbentuk `https://<project-ref>.supabase.co/auth/v1/callback`. Ini berbeda dari callback aplikasi `/auth/callback`.
- Confirm Email adalah keputusan owner. Jika dimatikan, signup password dapat menerima session segera tetapi tetap pending dengan role `NULL`; jika diaktifkan, email verification tetap diperlukan.

Jika akun super admin bekerja di localhost tetapi tidak di public application, repository tidak dapat memastikan penyebab dari sini. Klasifikasi paling mungkin adalah **A/B/G**: project Supabase atau Vercel environment berbeda, atau deployment public belum memuat source/environment yang sama. **C/D** perlu diperiksa bila login Google gagal di callback. **F** perlu diperiksa bila Auth user yang sama berhasil login tetapi membership/role database berbeda. Jangan membuat akun atau membership kedua sebagai workaround.

## Auth redirect checklist

Server Actions memakai Origin request yang divalidasi terhadap host untuk register verification dan forgot password, serta request origin untuk `/auth/callback`; tidak ada redirect auth yang memaksa localhost atau production.

Tambahkan URL berikut di Supabase Authentication > URL Configuration:

- Site URL: `https://DOMAIN-PRODUKSI-ANDA`
- Redirect URL: `http://localhost:3000/auth/callback`
- Redirect URL: `https://DOMAIN-PRODUKSI-ANDA/auth/callback`
- Redirect URL callback recovery: `http://localhost:3000/auth/callback?next=/reset-password`
- Redirect URL callback recovery production: `https://DOMAIN-PRODUKSI-ANDA/auth/callback?next=/reset-password`
- Redirect URL untuk reset password: `http://localhost:3000/reset-password`
- Redirect URL untuk reset password: `https://DOMAIN-PRODUKSI-ANDA/reset-password`

Gunakan pola `/**` hanya bila diperlukan oleh konfigurasi Supabase; callback recovery lengkap adalah `/auth/callback?next=/reset-password`; cocokkan URL dengan query ini juga bila aturan exact-match Supabase membutuhkannya. Jangan menambahkan wildcard domain yang terlalu luas.

## Runtime diagnostic checklist

Tidak ada halaman diagnostic public. Verifikasi environment secara aman dari dashboard Vercel/Supabase tanpa mencetak key: project URL local dan Vercel harus sama, publishable key harus berasal dari project tersebut, secret hanya pada server environment, dan deployment harus di-redeploy setelah perubahan.

Forgot-password menampilkan respons sama untuk permintaan yang diterima dan penolakan Auth 4xx. Gangguan jaringan/5xx menampilkan pesan layanan generik. Login menggunakan pesan generik yang sama untuk kredensial salah dan email belum diverifikasi. Status membership `pending`, `rejected`, atau `suspended` ditangani setelah user berhasil authenticated. Session cookie local dan production memang terpisah berdasarkan origin dan tidak boleh dibagikan.

## Email recovery dan verification

Gunakan template email Supabase berbasis `{{ .ConfirmationURL }}` untuk alur PKCE existing. Permintaan recovery menetapkan runtime origin + `/auth/callback?next=/reset-password`; register memakai runtime origin + `/auth/callback?next=/dashboard`. Jangan mengunci template ke localhost atau memakai Site URL sebagai pengganti RedirectTo.

Buka email di browser dan origin yang mengirim permintaan; PKCE membutuhkan verifier cookie. Browser lain, mode incognito, cookie yang dihapus, atau permintaan baru yang menggantikan verifier dapat membuat tautan gagal. UI mengarahkan pengguna meminta tautan baru. Custom template `token_hash`/implicit-fragment bukan flow yang diimplementasikan; jangan mengganti template tanpa menyesuaikan callback dan menguji kembali.

Konfirmasi secara manual di Supabase: email confirmation aktif, recovery expiry, rate limits, SMTP/domain pengirim, Site URL production, dan allowed redirects. Audit repository tidak dapat memastikan nilai dashboard, environment Vercel, atau deployment yang saat ini aktif.

Referensi: [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Development LAN dan diagnostik register

`next.config.ts` mengizinkan hostname development `10.10.33.202` secara exact melalui `allowedDevOrigins` hanya ketika NODE_ENV=development. Tidak memakai wildcard dan tidak menambah allowedOrigins Server Actions production. Restart dev server setelah perubahan konfigurasi. Bila HMR WebSocket tetap gagal, periksa DevTools Network WS, host/port, firewall, dan reverse proxy; allowlist tidak memperbaiki semua penyebab WebSocket.

Saat testing email di LAN, tambahkan callback LAN yang sesuai ke allowed redirects Supabase secara manual bila diperlukan. Jangan mengubah Site URL production ke alamat LAN.

Submit register valid harus menghasilkan `POST /register` dan log development `[auth.register] action invoked`. Hasil provider dicatat sebagai `signup accepted` dengan boolean userCreated/sessionCreated, atau kategori/status/pesan yang sudah disanitasi. Log ini tidak aktif di production dan tidak mencetak email, password, cookie, key, token, atau objek user/session. `signup accepted` bukan bukti email sudah terkirim atau akun baru benar-benar dibuat: verifikasi dashboard dan inbox tetap diperlukan.

Semua mutation auth memakai server client SSR publishable/session, bukan admin client. Permintaan signup sekarang berangkat dari server; browser Network menampilkan POST Server Action, sehingga tidak perlu terlihat request langsung browser ke endpoint Supabase signup.
