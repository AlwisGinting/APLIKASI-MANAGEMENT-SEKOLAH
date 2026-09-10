# Deployment

1. Buat project Supabase dan salin Project URL, publishable key, serta secret key dari Dashboard. Secret key hanya untuk environment server.
2. Jalankan migration `202609100001_foundation.sql` dan `202609100002_auth_membership_security.sql`, lalu `supabase/seed.sql`, melalui SQL Editor atau Supabase CLI.
3. Di Supabase Auth URL Configuration, tambahkan `http://localhost:3000/auth/callback` dan `https://DOMAIN-VERCEL-ANDA/auth/callback`. Set Site URL ke domain production setelah diketahui.
4. Hubungkan repository GitHub ini ke Vercel.
5. Gunakan `develop` untuk preview dan `main` untuk production.
6. Tambahkan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY` pada Vercel sesuai environment. Secret key tidak diperlukan oleh browser.
7. Setelah lint, type-check, dan build lokal berhasil, push branch untuk memicu deployment.

Supabase CLI belum tersedia di komputer ini. Instal sesuai dokumentasi resmi Supabase jika diperlukan, atau gunakan SQL Editor. Setelah CLI tersedia, struktur `supabase/migrations` sudah siap dipakai.

Jangan memasukkan `.env`, `.env.local`, credential, atau service role key ke Git.
