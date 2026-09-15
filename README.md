# SIM KB DEVFANTA MELATI

Foundation aplikasi Sistem Informasi Manajemen sekolah PAUD/KB berbasis Next.js, PWA-ready, dan Supabase. Struktur data menggunakan multi-tenant `schools` dan `school_memberships`, sehingga satu pengguna dapat memiliki akses ke beberapa sekolah.

## Stack

- Next.js stable, App Router, React, TypeScript, Tailwind CSS
- Supabase PostgreSQL, Authentication, Storage, dan Row Level Security
- Vercel untuk deployment

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Isi nilai Supabase di `.env.local`. File environment tidak boleh di-commit.

Gunakan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` untuk client/browser dan `SUPABASE_SECRET_KEY` hanya di server bila administrative access memang diperlukan.

Local dan production harus memakai project Supabase yang sama untuk berbagi akun Auth. Checklist environment dan redirect tersedia di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm run build
npm run check
npm run test:foundation
```

## Git workflow

- `main` = production dan branch deployment production.
- `develop` = development dan branch preview/integrasi.
- `feature/*` = branch pekerjaan fitur dari `develop`.
- Push hanya dilakukan setelah lint, type-check, dan build berhasil.
- Tidak ada proses git push otomatis saat file disimpan.

## Database

Migration 001–004 sudah diterapkan dan immutable. Migration 005 feedback dan 006 profil sekolah belum diterapkan; jangan menjalankan migration atau seed otomatis pada project existing. Backup mengikuti prosedur terpisah dari GitHub. Lihat [docs/DATABASE.md](docs/DATABASE.md).

## Dokumentasi

- [Arsitektur](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Production readiness dan hasil audit](docs/PRODUCTION.md)
- [Backup](docs/BACKUP.md)
