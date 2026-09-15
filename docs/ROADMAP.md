# Roadmap

## Foundation selesai

- Next.js App Router, TypeScript, Tailwind, route publik, dan dashboard placeholder.
- Supabase browser/server utilities serta konfigurasi environment.
- Schema multi-tenant awal, enum role/status, seed sekolah, dan RLS awal.
- Dokumentasi arsitektur, keamanan, deployment, dan backup.

## Prioritas sekarang: penerimaan account & app shell

- Auth register/login/recovery dinyatakan normal oleh pemilik. Pertahankan regresinya; lanjutkan penerimaan profil, preferensi, navigasi, dan school profile.
- Review manual migration 005 feedback dan 006 school profile sebelum diterapkan.
- Uji drawer/dialog keyboard, theme system/light/dark, dan self-service account dengan dua tenant.
- Samakan konfigurasi Supabase project, env deployment, Site URL, redirects, dan SMTP.
- Uji authorization dan RLS menggunakan dua tenant dan seluruh role.
- Putuskan kebijakan membership admin terakhir serta akses Storage sebelum menambah data sensitif.
- Uji backup/restore dan monitoring; tinjau batas kesiapan di PRODUCTION.

Modul siswa, guru, orang tua, absensi, penilaian, raport, dan keuangan ditunda sampai foundation diterima. Tidak ada fitur bisnis baru dalam pekerjaan hardening ini.
