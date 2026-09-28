-- MIGRATION 008 IS DRAFT / NOT APPLIED. Manual review and disposable tests required.
-- Requires applied, immutable 001-007. No legacy object/data rewrite or upload enablement.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Abort on unknown Storage policies rather than silently deleting unrelated rules.
lock table storage.objects in share row exclusive mode;
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname not in (
        'tenant members can read private files', 'tenant members can upload private files',
        'tenant members can update private files', 'tenant members can delete private files',
        'active tenant members can read private files', 'active tenant members can upload private files',
        'active tenant members can update private files', 'active tenant members can delete private files',
        '008 storage scope gate', '008 avatars owner read', '008 storage delete deny'
      )
  ) then raise exception '008 requires review of unknown Storage policies'; end if;
  if (select count(*) from storage.buckets where id in
    ('avatars', 'student-documents', 'teacher-documents', 'attendance-photos') and not public) <> 4
  then raise exception '008 requires all four existing buckets to be private'; end if;
end;
$$;

-- Definer ownership must be a trusted migration role able to bypass source RLS.
-- This avoids schools -> memberships -> schools policy recursion. No caller actor parameter.
create or replace function public.is_school_member(target_school_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.school_memberships m
    join public.schools s on s.id = m.school_id
    where m.school_id = target_school_id and m.user_id = auth.uid()
      and m.status = 'active'::public.membership_status and s.is_active
  );
$$;
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
revoke all on function public.is_school_member(uuid), public.has_school_role(uuid, public.app_role[]) from public, anon;
grant execute on function public.is_school_member(uuid), public.has_school_role(uuid, public.app_role[]) to authenticated;
-- Existing dependent RPCs stay SECURITY INVOKER; default-semester definers stay trigger-only.
alter function public.activate_academic_year(uuid) set search_path = pg_catalog;
alter function public.activate_semester(uuid) set search_path = pg_catalog;
alter function public.ensure_default_semesters(uuid, uuid, text, date, date, boolean) set search_path = pg_catalog;
alter function public.create_default_semesters_for_year() set search_path = pg_catalog;
alter function public.prevent_non_super_admin_semester_name_change() set search_path = pg_catalog;
revoke all on function public.ensure_default_semesters(uuid, uuid, text, date, date, boolean),
  public.create_default_semesters_for_year() from public, anon, authenticated;

-- Only the existing Auth trigger admits new users to the intended default school.
-- Trigger execution does not require browser INSERT or function EXECUTE privileges.
drop policy if exists "users can create pending memberships" on public.school_memberships;
revoke insert, delete, truncate on public.school_memberships from public, anon, authenticated;
revoke insert (id, school_id, user_id, role, status, approved_by, approved_at, created_at, updated_at)
  on public.school_memberships from public, anon, authenticated;
alter function public.handle_new_user() set search_path = pg_catalog;
alter function public.prevent_membership_identity_change() set search_path = pg_catalog;
revoke all on function public.handle_new_user(), public.prevent_membership_identity_change() from public, anon, authenticated;

-- A private materialized count is also the per-school serialization row.
-- Unlike lock + snapshot count, actual writes conflict at REPEATABLE READ too.
-- Lock the source during bootstrap; never infer a zero count for an existing tenant.
lock table public.schools, public.school_memberships in share row exclusive mode;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table if not exists app_private.school_admin_state (
  school_id uuid primary key references public.schools(id) on delete restrict,
  active_super_admins bigint not null check (active_super_admins >= 0),
  revision bigint not null default 0
);
alter table app_private.school_admin_state enable row level security;
revoke all on app_private.school_admin_state from public, anon, authenticated;
insert into app_private.school_admin_state (school_id, active_super_admins)
select s.id, count(m.id) filter (where m.status = 'active' and m.role = 'super_admin')
from public.schools s left join public.school_memberships m on m.school_id = s.id
group by s.id
on conflict (school_id) do update set active_super_admins = excluded.active_super_admins;

create or replace function app_private.guard_membership_change()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare
  tenant_id uuid;
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  touches_sa boolean := false;
begin
  if TG_OP = 'DELETE' then tenant_id := old.school_id;
  else tenant_id := new.school_id; end if;
  if TG_OP = 'UPDATE' and (new.id is distinct from old.id
    or new.school_id is distinct from old.school_id or new.user_id is distinct from old.user_id)
  then raise exception using errcode = 'P8002', message = 'Membership identity is immutable'; end if;
  -- New schools get a zero row only before their first real membership insert.
  if TG_OP = 'INSERT' then
    insert into app_private.school_admin_state (school_id, active_super_admins)
    values (tenant_id, 0) on conflict (school_id) do nothing;
  end if;
  update app_private.school_admin_state set revision = revision + 1 where school_id = tenant_id;
  if not found then raise exception using errcode = 'P8003', message = 'Membership guard unavailable'; end if;
  if TG_OP <> 'INSERT' then touches_sa := old.role = 'super_admin'; end if;
  if TG_OP <> 'DELETE' then touches_sa := coalesce(touches_sa, false) or coalesce(new.role = 'super_admin', false); end if;
  -- NULL principal is trusted Auth signup/owner maintenance, never a browser bypass:
  -- anon has no mutation grants; authenticated INSERT/DELETE are revoked above.
  if actor_id is not null and (TG_OP <> 'INSERT' or touches_sa) then
    select m.role into actor_role from public.school_memberships m
    join public.schools s on s.id = m.school_id
    where m.school_id = tenant_id and m.user_id = actor_id and m.status = 'active' and s.is_active;
    if actor_role is null or actor_role not in ('super_admin', 'kepala_sekolah')
      or (touches_sa and actor_role <> 'super_admin')
    then raise exception using errcode = 'P8002', message = 'Membership change not permitted'; end if;
  end if;
  if TG_OP = 'UPDATE' then
    if new.status is distinct from old.status or new.role is distinct from old.role then
      new.approved_by := case when new.status = 'active' then actor_id else null end;
      new.approved_at := case when new.status = 'active' then now() else null end;
    else
      new.approved_by := old.approved_by;
      new.approved_at := old.approved_at;
    end if;
    new.updated_at := now();
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function app_private.count_membership_change()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare
  tenant_id uuid;
  delta integer := 0;
begin
  if TG_OP <> 'INSERT' then
    tenant_id := old.school_id;
    if old.status = 'active' and old.role = 'super_admin' then delta := delta - 1; end if;
  end if;
  if TG_OP <> 'DELETE' then
    tenant_id := new.school_id;
    if new.status = 'active' and new.role = 'super_admin' then delta := delta + 1; end if;
  end if;
  -- AFTER only: INSERT ON CONFLICT DO NOTHING must not change the count.
  -- The BEFORE guard already holds the serialization row until transaction end.
  update app_private.school_admin_state
  set active_super_admins = active_super_admins + delta
  where school_id = tenant_id and active_super_admins + delta >= 0
    and (delta >= 0 or active_super_admins + delta > 0);
  if not found then raise exception using errcode = 'P8001', message = 'Last active super admin is protected'; end if;
  return null;
end;
$$;
revoke all on function app_private.guard_membership_change(), app_private.count_membership_change() from public, anon, authenticated;
drop trigger if exists school_memberships_008_guard on public.school_memberships;
create trigger school_memberships_008_guard before insert or update or delete on public.school_memberships
for each row execute function app_private.guard_membership_change();
drop trigger if exists school_memberships_008_count on public.school_memberships;
create trigger school_memberships_008_count after insert or update or delete on public.school_memberships
for each row execute function app_private.count_membership_change();

-- Tighten normal UPDATE columns; approval/time inputs remain compatible with the
-- existing action but are derived/preserved by the trigger, never trusted.
revoke update on public.school_memberships from public, anon, authenticated;
revoke update (id, school_id, user_id, role, status, approved_by, approved_at, created_at, updated_at)
  on public.school_memberships from public, anon, authenticated;
grant update (role, status, approved_by, approved_at, updated_at) on public.school_memberships to authenticated;

-- M2: 004 already protects UPDATE names; cover INSERT without changing defaults.
create or replace function public.guard_semester_insert_name()
returns trigger language plpgsql set search_path = pg_catalog
as $$
begin
  if new.name not in ('Ganjil', 'Genap') and not public.has_school_role(new.school_id, array['super_admin']::public.app_role[])
  then raise exception using errcode = '42501', message = 'Custom semester name not permitted'; end if;
  return new;
end;
$$;
revoke all on function public.guard_semester_insert_name() from public, anon, authenticated;
drop trigger if exists semesters_008_insert_name on public.semesters;
create trigger semesters_008_insert_name before insert on public.semesters
for each row execute function public.guard_semester_insert_name();

-- M3: own profile edits require an active school; creation remains Auth-trigger-only.
revoke insert, update on public.profiles from public, anon, authenticated;
revoke insert (id, full_name, phone, avatar_path, created_at, updated_at),
  update (id, full_name, phone, avatar_path, created_at, updated_at)
  on public.profiles from public, anon, authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile" on public.profiles for update to authenticated
using (id = auth.uid() and exists (
  select 1 from public.school_memberships m where m.user_id = auth.uid() and public.is_school_member(m.school_id)
))
with check (id = auth.uid() and exists (
  select 1 from public.school_memberships m where m.user_id = auth.uid() and public.is_school_member(m.school_id)
));
create or replace function public.guard_profile_edit()
returns trigger language plpgsql set search_path = pg_catalog
as $$
begin
  new.full_name := btrim(new.full_name);
  new.phone := nullif(btrim(new.phone), '');
  if new.full_name is null or char_length(new.full_name) not between 1 and 150
    or (new.phone is not null and (char_length(new.phone) > 40 or new.phone !~ '^[+0-9[:space:]().-]+$'))
  then raise exception using errcode = '23514', message = 'Invalid profile fields'; end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_profile_edit() from public, anon, authenticated;
drop trigger if exists profiles_008_edit on public.profiles;
create trigger profiles_008_edit before update on public.profiles for each row execute function public.guard_profile_edit();

-- Read-only avatar foundation. Storage owner_id AND subject AND tenant must agree.
-- File extensions constrain names, not verified bytes. Upload/type verification is deferred.
create or replace function public.can_read_own_avatar(object_name text, object_owner text)
returns boolean language plpgsql stable set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or object_owner is distinct from auth.uid()::text or object_name is null
    or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/v1/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  then return false; end if;
  -- PL/pgSQL avoids SQL-function inlining/constant folding of malformed casts.
  return split_part(object_name, '/', 3) = auth.uid()::text
    and public.is_school_member(split_part(object_name, '/', 1)::uuid);
end;
$$;
revoke all on function public.can_read_own_avatar(text, text) from public, anon;
grant execute on function public.can_read_own_avatar(text, text) to authenticated;

drop policy if exists "tenant members can read private files" on storage.objects;
drop policy if exists "tenant members can upload private files" on storage.objects;
drop policy if exists "tenant members can update private files" on storage.objects;
drop policy if exists "tenant members can delete private files" on storage.objects;
drop policy if exists "active tenant members can read private files" on storage.objects;
drop policy if exists "active tenant members can upload private files" on storage.objects;
drop policy if exists "active tenant members can update private files" on storage.objects;
drop policy if exists "active tenant members can delete private files" on storage.objects;
revoke all on function public.storage_school_id(text) from public, anon, authenticated;
drop policy if exists "008 storage scope gate" on storage.objects;
drop policy if exists "008 avatars owner read" on storage.objects;
drop policy if exists "008 storage delete deny" on storage.objects;
create policy "008 storage scope gate" on storage.objects as restrictive for all to authenticated
using (bucket_id = 'avatars' and public.can_read_own_avatar(name, owner_id))
with check (false);
create policy "008 avatars owner read" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and public.can_read_own_avatar(name, owner_id));
create policy "008 storage delete deny" on storage.objects as restrictive for delete to authenticated
using (false);
-- No anon policies, no INSERT/UPDATE/DELETE permissive policies, no binary mutation.
-- Business/unknown buckets fail the restrictive gate even if a future permissive
-- policy is added. New write functionality needs its own reviewed migration.
commit;
