-- DRAFT / NOT APPLIED. Requires immutable 001-007 and reviewed 008-009.
-- F7 Stage 1: Avatar Storage Hardening & Explicit Mutation Denial.
-- Restricts Supabase Storage to read-only access for own avatar with active membership.
-- All business document buckets remain strictly default-deny.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- 1. Preflight lock & validation
lock table storage.objects in share row exclusive mode;

do $$
begin
  -- Pastikan skema storage tersedia
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception '010 requires storage schema to exist';
  end if;

  -- Periksa agar tidak ada policy asing di luar policy yang sudah diketahui/ditinjau
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname not in (
        'tenant members can read private files', 'tenant members can upload private files',
        'tenant members can update private files', 'tenant members can delete private files',
        'active tenant members can read private files', 'active tenant members can upload private files',
        'active tenant members can update private files', 'active tenant members can delete private files',
        '008 storage scope gate', '008 avatars owner read', '008 storage delete deny',
        '010 storage scope gate', '010 avatars owner read', '010 storage update deny', '010 storage delete deny'
      )
  ) then
    raise exception '010 requires review of unknown Storage policies';
  end if;

  -- Validasi bahwa 4 bucket wajib ada tanpa memodifikasi storage.buckets
  if (select count(*) from storage.buckets where id in
    ('avatars', 'student-documents', 'teacher-documents', 'attendance-photos')) <> 4
  then
    raise exception '010 requires all four standard storage buckets to exist';
  end if;

  -- Validasi bahwa 4 bucket wajib berstatus private; jangan ubah diam-diam
  if exists (
    select 1 from storage.buckets
    where id in ('avatars', 'student-documents', 'teacher-documents', 'attendance-photos') and public
  ) then
    raise exception '010 requires all four standard storage buckets to be private';
  end if;
end;
$$;

-- 2. Bersihkan seluruh policy lama secara atomik
drop policy if exists "tenant members can read private files" on storage.objects;
drop policy if exists "tenant members can upload private files" on storage.objects;
drop policy if exists "tenant members can update private files" on storage.objects;
drop policy if exists "tenant members can delete private files" on storage.objects;
drop policy if exists "active tenant members can read private files" on storage.objects;
drop policy if exists "active tenant members can upload private files" on storage.objects;
drop policy if exists "active tenant members can update private files" on storage.objects;
drop policy if exists "active tenant members can delete private files" on storage.objects;
drop policy if exists "008 storage scope gate" on storage.objects;
drop policy if exists "008 avatars owner read" on storage.objects;
drop policy if exists "008 storage delete deny" on storage.objects;
drop policy if exists "010 storage scope gate" on storage.objects;
drop policy if exists "010 avatars owner read" on storage.objects;
drop policy if exists "010 storage update deny" on storage.objects;
drop policy if exists "010 storage delete deny" on storage.objects;

-- Cabut helper 002 yang tidak aman terhadap malformed UUID
revoke all on function public.storage_school_id(text) from public, anon, authenticated;

-- 3. Pastikan has_school_role aman dari RLS recursion dan memeriksa status aktif
create or replace function public.has_school_role(target_school_id uuid, allowed_roles public.app_role[])
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.school_memberships m
    join public.schools s on s.id = m.school_id
    where m.school_id = target_school_id and m.user_id = auth.uid()
      and m.status = 'active'::public.membership_status and s.is_active
      and m.role = any(allowed_roles)
  );
$$;
revoke all on function public.has_school_role(uuid, public.app_role[]) from public, anon;
grant execute on function public.has_school_role(uuid, public.app_role[]) to authenticated;

-- 4. Helper can_read_own_avatar: fail-closed, validasi format path kanonikal, owner_id dan membership aktif
create or replace function public.can_read_own_avatar(object_name text, object_owner text)
returns boolean language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  -- Tolak jika anonim, atau stored owner_id tidak sama persis dengan auth.uid(), atau nama kosong
  if auth.uid() is null or object_owner is distinct from auth.uid()::text or object_name is null
    or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/v1/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  then
    return false;
  end if;

  -- Segmen 3 harus merupakan UUID dari pengguna yang terautentikasi
  -- Segmen 1 harus merupakan sekolah di mana pengguna memiliki membership aktif dan peran operasional
  return split_part(object_name, '/', 3) = auth.uid()::text
    and public.has_school_role(
      split_part(object_name, '/', 1)::uuid,
      array['super_admin', 'kepala_sekolah', 'operator', 'guru', 'orang_tua']::public.app_role[]
    );
end;
$$;
revoke all on function public.can_read_own_avatar(text, text) from public, anon;
grant execute on function public.can_read_own_avatar(text, text) to authenticated;

-- 5. Kebijakan RLS storage.objects
-- A. Restrictive Scope Gate: HANYA bucket 'avatars' dengan pembacaan yang sah. with check (false) menolak seluruh INSERT/UPDATE.
create policy "010 storage scope gate" on storage.objects
as restrictive for all to authenticated
using (bucket_id = 'avatars' and public.can_read_own_avatar(name, owner_id))
with check (false);

-- B. Permissive SELECT: Pengguna authenticated dapat membaca avatar miliknya
create policy "010 avatars owner read" on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and public.can_read_own_avatar(name, owner_id));

-- C. Explicit Restrictive UPDATE Deny: Tolak seluruh UPDATE secara eksplisit
create policy "010 storage update deny" on storage.objects
as restrictive for update to authenticated
using (false)
with check (false);

-- D. Explicit Restrictive DELETE Deny: Tolak seluruh DELETE secara eksplisit
create policy "010 storage delete deny" on storage.objects
as restrictive for delete to authenticated
using (false);

commit;
