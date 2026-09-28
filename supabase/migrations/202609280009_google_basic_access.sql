-- DRAFT / NOT APPLIED. Requires immutable 001-007 and reviewed 008.
-- Product admission change, separate from 008 security hardening. No backfill.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$
begin
  if to_regclass('app_private.school_admin_state') is null
    or to_regprocedure('public.can_read_own_avatar(text,text)') is null
    or not exists (select from pg_trigger where tgrelid='public.school_memberships'::regclass
                   and tgname='school_memberships_008_count' and tgenabled='O') then
    raise exception '009 requires completed 008';
  end if;
end $$;
lock table public.school_memberships in share row exclusive mode;
-- NULL is basic access, never a privileged role; enum and unique tenant/user key stay.
alter table public.school_memberships drop constraint active_membership_requires_role;

-- Run at transaction completion so the Auth-owned identity row is visible.
-- Only INSERT of a NEW auth.users row schedules admission. Linking an identity
-- or signing into an existing user does not schedule it. No browser RPC exists.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare default_school_id uuid; google_first boolean;
begin
  if TG_OP <> 'INSERT' or TG_TABLE_SCHEMA <> 'auth' or TG_TABLE_NAME <> 'users' then
    raise exception 'Invalid admission trigger';
  end if;
  select exists (select from auth.identities i where i.user_id=new.id and i.provider='google')
    and not exists (select from auth.identities i where i.user_id=new.id and i.provider <> 'google')
    into google_first;
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
                          nullif(split_part(new.email, '@', 1), ''), 'Pengguna'))
  on conflict (id) do nothing;
  select id into default_school_id from public.schools
  where slug='kb-devfanta-melati' and is_active for share;
  if default_school_id is null then
    raise exception using errcode='P9001', message='Default school unavailable';
  end if;
  -- Existing rows, including role/status/approval timestamps, are never updated.
  insert into public.school_memberships (school_id,user_id,status,role)
  values (default_school_id,new.id,
          case when google_first then 'active'::public.membership_status
               else 'pending'::public.membership_status end, null)
  on conflict (school_id,user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger on_auth_user_created on auth.users;
create constraint trigger on_auth_user_created after insert on auth.users
deferrable initially deferred for each row execute function public.handle_new_user();

-- 008 still serializes membership writes and protects the final active SA.
-- This additional guard restricts ALL role changes, not only changes involving SA.
create function app_private.guard_role_assignment()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if new.role is distinct from old.role and not public.has_school_role(
    old.school_id, array['super_admin']::public.app_role[]
  ) then
    raise exception using errcode='P8002', message='Role assignment requires Super Admin';
  end if;
  return new;
end $$;
revoke all on function app_private.guard_role_assignment() from public, anon, authenticated;
create trigger school_memberships_009_role_guard before update on public.school_memberships
for each row execute function app_private.guard_role_assignment();

-- Roleless membership may read its school/own profile/membership, not feedback.
-- Restrictive policy intersects existing permissive policies and covers all commands.
create policy "009 feedback requires assigned role" on public.feedbacks
as restrictive for all to authenticated
using (public.has_school_role(school_id, array['super_admin','kepala_sekolah','operator','guru','orang_tua']::public.app_role[]))
with check (public.has_school_role(school_id, array['super_admin','kepala_sekolah','operator','guru','orang_tua']::public.app_role[]));

-- Retain all canonical owner/path checks and deny even own avatars to basic access.
create or replace function public.can_read_own_avatar(object_name text, object_owner text)
returns boolean language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or object_owner is distinct from auth.uid()::text or object_name is null
    or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/v1/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  then return false; end if;
  return split_part(object_name, '/', 3)=auth.uid()::text
    and public.has_school_role(split_part(object_name, '/', 1)::uuid,
      array['super_admin','kepala_sekolah','operator','guru','orang_tua']::public.app_role[]);
end $$;
revoke all on function public.can_read_own_avatar(text,text) from public, anon;
grant execute on function public.can_read_own_avatar(text,text) to authenticated;
-- Academic activation is not signup/admission. Keep authenticated invoker checks.
revoke all on function public.activate_academic_year(uuid), public.activate_semester(uuid) from public, anon;
grant execute on function public.activate_academic_year(uuid), public.activate_semester(uuid) to authenticated;
commit;
