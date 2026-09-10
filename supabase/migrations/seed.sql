-- Seed data SIM KB DEVFANTA MELATI.
-- Aman dijalankan ulang karena menggunakan ON CONFLICT.

insert into public.schools (
  id,
  name,
  slug,
  is_active
)
values (
  '00000000-0000-0000-0000-000000000001',
  'KB DEVFANTA MELATI',
  'kb-devfanta-melati',
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  is_active = excluded.is_active,
  updated_at = now();