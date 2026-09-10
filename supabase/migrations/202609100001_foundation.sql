-- Foundation schema for SIM KB DEVFANTA MELATI.
-- This migration creates the multi-tenant foundation only.

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum (
    'super_admin',
    'kepala_sekolah',
    'operator',
    'guru',
    'orang_tua'
  );
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.membership_status as enum (
    'pending',
    'approved',
    'rejected',
    'suspended'
  );
exception when duplicate_object then null;
end;
$$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role,
  status public.membership_status not null default 'pending',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id),
  constraint approved_membership_has_role check (
    status <> 'approved' or role is not null
  )
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  constraint academic_year_dates_valid check (end_date >= start_date)
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, name),
  constraint semester_dates_valid check (end_date >= start_date)
);

insert into public.schools (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000001',
  'KB DEVFANTA MELATI',
  'kb-devfanta-melati'
)
on conflict (slug) do update
set name = excluded.name,
    is_active = true,
    updated_at = now();

create index if not exists school_memberships_user_id_idx
  on public.school_memberships(user_id);
create index if not exists school_memberships_school_status_idx
  on public.school_memberships(school_id, status);
create index if not exists academic_years_school_id_idx
  on public.academic_years(school_id);
create index if not exists academic_years_school_active_idx
  on public.academic_years(school_id, is_active);
create index if not exists semesters_academic_year_id_idx
  on public.semesters(academic_year_id);
create index if not exists semesters_academic_year_active_idx
  on public.semesters(academic_year_id, is_active);

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
      and status = 'approved'::public.membership_status
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
      and status = 'approved'::public.membership_status
      and role = any(allowed_roles)
  );
$$;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_memberships enable row level security;
alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;

drop policy if exists "approved members can view their schools" on public.schools;
create policy "approved members can view their schools"
on public.schools for select to authenticated
using (public.is_school_member(id));

drop policy if exists "users can view their own profile" on public.profiles;
create policy "users can view their own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users can view their memberships" on public.school_memberships;
create policy "users can view their memberships"
on public.school_memberships for select to authenticated
using (
  user_id = auth.uid()
  or public.has_school_role(
    school_id,
    array['super_admin', 'kepala_sekolah']::public.app_role[]
  )
);

drop policy if exists "users can create pending memberships" on public.school_memberships;
create policy "users can create pending memberships"
on public.school_memberships for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'::public.membership_status
  and role is null
);

drop policy if exists "school admins can approve memberships" on public.school_memberships;
create policy "school admins can approve memberships"
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
);

drop policy if exists "active members can view academic years" on public.academic_years;
create policy "active members can view academic years"
on public.academic_years for select to authenticated
using (public.is_school_member(school_id));

drop policy if exists "active members can view semesters" on public.semesters;
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

revoke all on public.schools, public.profiles, public.school_memberships,
  public.academic_years, public.semesters from anon;
grant usage on schema public to authenticated;
grant select on public.schools, public.profiles, public.school_memberships,
  public.academic_years, public.semesters to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.school_memberships to authenticated;
