-- Auth and approval hardening.
-- Recovery-safe after a partial application of 202609100001_foundation.sql.
-- The legacy enum value `approved` is intentionally retained because PostgreSQL
-- does not support safely removing enum values in a portable migration.

alter type public.membership_status add value if not exists 'active';

-- Normalize memberships created by the first migration before enforcing the
-- active-membership invariant. The legacy enum value remains available.
update public.school_memberships
set status = 'active'::public.membership_status,
    updated_at = now()
where status::text = 'approved';

alter table public.school_memberships
  drop constraint if exists approved_membership_has_role,
  drop constraint if exists active_membership_requires_role;

alter table public.school_memberships
  add constraint active_membership_requires_role
  check (status <> 'active'::public.membership_status or role is not null);

create index if not exists school_memberships_user_id_idx
  on public.school_memberships(user_id);
create index if not exists school_memberships_school_status_idx
  on public.school_memberships(school_id, status);

create or replace function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_memberships
    where school_id = target_school_id
      and user_id = auth.uid()
      and status = 'active'::public.membership_status
  );
$$;

create or replace function public.has_school_role(
  target_school_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_memberships
    where school_id = target_school_id
      and user_id = auth.uid()
      and status = 'active'::public.membership_status
      and role = any(allowed_roles)
  );
$$;

create or replace function public.prevent_membership_identity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.school_id <> old.school_id or new.user_id <> old.user_id then
    raise exception 'school_id and user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists school_memberships_identity_guard on public.school_memberships;
create trigger school_memberships_identity_guard
before update on public.school_memberships
for each row execute function public.prevent_membership_identity_change();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_school_id uuid;
  display_name text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1),
    'Pengguna'
  );

  insert into public.profiles (id, full_name)
  values (new.id, display_name)
  on conflict (id) do nothing;

  select id into default_school_id
  from public.schools
  where slug = 'kb-devfanta-melati'
    and is_active = true
  limit 1;

  if default_school_id is not null then
    insert into public.school_memberships (school_id, user_id, status, role)
    values (default_school_id, new.id, 'pending', null)
    on conflict (school_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Remove policies from both the initial migration and a partial run of this
-- migration before recreating the active-membership policy set.
drop policy if exists "approved members can view their schools" on public.schools;
drop policy if exists "active members can view their schools" on public.schools;
drop policy if exists "users can view their own profile" on public.profiles;
drop policy if exists "users and school admins can view profiles" on public.profiles;
drop policy if exists "users and active school admins can view profiles" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;
drop policy if exists "users can view their memberships" on public.school_memberships;
drop policy if exists "users and school admins can view memberships" on public.school_memberships;
drop policy if exists "users and active school admins can view memberships" on public.school_memberships;
drop policy if exists "users can create pending memberships" on public.school_memberships;
drop policy if exists "school admins can approve memberships" on public.school_memberships;
drop policy if exists "school admins can manage membership state" on public.school_memberships;
drop policy if exists "active school admins can manage membership state" on public.school_memberships;
drop policy if exists "tenant members can read private files" on storage.objects;
drop policy if exists "tenant members can upload private files" on storage.objects;
drop policy if exists "tenant members can update private files" on storage.objects;
drop policy if exists "tenant members can delete private files" on storage.objects;
drop policy if exists "active tenant members can read private files" on storage.objects;
drop policy if exists "active tenant members can upload private files" on storage.objects;
drop policy if exists "active tenant members can update private files" on storage.objects;
drop policy if exists "active tenant members can delete private files" on storage.objects;

drop policy if exists "active members can view academic years" on public.academic_years;
drop policy if exists "active members can view semesters" on public.semesters;

create policy "active members can view their schools"
on public.schools for select to authenticated
using (public.is_school_member(id));

create policy "users and active school admins can view profiles"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.school_memberships m
    where m.user_id = profiles.id
      and public.has_school_role(
        m.school_id,
        array['super_admin', 'kepala_sekolah']::public.app_role[]
      )
  )
);

create policy "users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "users and active school admins can view memberships"
on public.school_memberships for select to authenticated
using (
  user_id = auth.uid()
  or public.has_school_role(
    school_id,
    array['super_admin', 'kepala_sekolah']::public.app_role[]
  )
);

create policy "users can create pending memberships"
on public.school_memberships for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'::public.membership_status
  and role is null
);

create policy "active school admins can manage membership state"
on public.school_memberships for update to authenticated
using (
  public.has_school_role(
    school_id,
    array['super_admin', 'kepala_sekolah']::public.app_role[]
  )
)
with check (
  public.has_school_role(
    school_id,
    array['super_admin', 'kepala_sekolah']::public.app_role[]
  )
  and (approved_by is null or approved_by = auth.uid())
);

create policy "active members can view academic years"
on public.academic_years for select to authenticated
using (public.is_school_member(school_id));

create policy "active members can view semesters"
on public.semesters for select to authenticated
using (
  exists (
    select 1
    from public.academic_years ay
    where ay.id = academic_year_id
      and public.is_school_member(ay.school_id)
  )
);

grant usage on schema public to authenticated;
grant select on public.schools, public.profiles, public.school_memberships,
  public.academic_years, public.semesters to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.school_memberships to authenticated;

insert into storage.buckets (id, name, public)
values
  ('student-documents', 'student-documents', false),
  ('teacher-documents', 'teacher-documents', false),
  ('attendance-photos', 'attendance-photos', false),
  ('avatars', 'avatars', false)
on conflict (id) do update set public = false;

create or replace function public.storage_school_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

create policy "active tenant members can read private files"
on storage.objects for select to authenticated
using (public.is_school_member(public.storage_school_id(name)));

create policy "active tenant members can upload private files"
on storage.objects for insert to authenticated
with check (public.is_school_member(public.storage_school_id(name)));

create policy "active tenant members can update private files"
on storage.objects for update to authenticated
using (public.is_school_member(public.storage_school_id(name)))
with check (public.is_school_member(public.storage_school_id(name)));

create policy "active tenant members can delete private files"
on storage.objects for delete to authenticated
using (public.is_school_member(public.storage_school_id(name)));

-- Bootstrap admin remains a manual, audited SQL step. See docs/SECURITY.md.
