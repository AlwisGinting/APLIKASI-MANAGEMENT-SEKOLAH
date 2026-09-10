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
