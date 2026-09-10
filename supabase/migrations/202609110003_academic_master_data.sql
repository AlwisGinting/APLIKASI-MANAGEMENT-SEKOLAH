-- Academic master data hardening.
-- Apply after 202609100001_foundation.sql and 202609100002_auth_membership_security.sql.
-- No student, teacher, enrollment, or operational tables are created here.

-- Required parent key must exist before any composite foreign key is added.
alter table public.academic_years
  drop constraint if exists academic_years_school_id_id_key;
alter table public.academic_years
  add constraint academic_years_school_id_id_key unique (school_id, id);

alter table public.semesters
  add column if not exists school_id uuid;

update public.semesters s
set school_id = ay.school_id
from public.academic_years ay
where ay.id = s.academic_year_id
  and s.school_id is null;

do $$
begin
  if exists (select 1 from public.semesters where school_id is null) then
    raise exception 'Tidak dapat melanjutkan: terdapat semester tanpa school_id setelah backfill';
  end if;
  if exists (
    select 1
    from public.semesters s
    left join public.academic_years ay on ay.id = s.academic_year_id
    where ay.id is null or ay.school_id <> s.school_id
  ) then
    raise exception 'Tidak dapat melanjutkan: terdapat semester dengan academic_year lintas sekolah atau orphan';
  end if;
end;
$$;

alter table public.semesters
  alter column school_id set not null;
alter table public.semesters
  drop constraint if exists semesters_academic_year_id_fkey;
alter table public.semesters
  add constraint semesters_academic_year_id_fkey
  foreign key (academic_year_id) references public.academic_years(id) on delete restrict;
alter table public.semesters
  drop constraint if exists semesters_school_id_fkey;
alter table public.semesters
  add constraint semesters_school_id_fkey
  foreign key (school_id) references public.schools(id) on delete cascade;
alter table public.semesters
  drop constraint if exists semesters_academic_year_school_check;
alter table public.semesters
  add constraint semesters_academic_year_school_check
  foreign key (school_id, academic_year_id)
  references public.academic_years(school_id, id)
  on delete restrict;

alter table public.academic_years
  drop constraint if exists academic_year_dates_valid;
alter table public.academic_years
  add constraint academic_year_dates_valid check (start_date < end_date);
alter table public.semesters
  drop constraint if exists semester_dates_valid;
alter table public.semesters
  add constraint semester_dates_valid check (start_date < end_date);

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null,
  name text not null,
  code text,
  level text,
  capacity integer,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classrooms_name_not_blank check (length(btrim(name)) > 0),
  constraint classrooms_capacity_positive check (capacity is null or capacity > 0),
  constraint classrooms_school_year_fk foreign key (school_id, academic_year_id)
    references public.academic_years(school_id, id) on delete restrict,
  constraint classrooms_school_year_name_unique unique (school_id, academic_year_id, name)
);

create index if not exists semesters_school_id_idx on public.semesters(school_id);
create index if not exists classrooms_school_id_idx on public.classrooms(school_id);
create index if not exists classrooms_school_year_idx on public.classrooms(school_id, academic_year_id);
create index if not exists classrooms_school_active_idx on public.classrooms(school_id, is_active);

do $$
begin
  if exists (select 1 from public.academic_years where is_active group by school_id having count(*) > 1) then
    raise exception 'Tidak dapat membuat index: lebih dari satu academic_year aktif dalam satu sekolah';
  end if;
  if exists (select 1 from public.semesters where is_active group by school_id, academic_year_id having count(*) > 1) then
    raise exception 'Tidak dapat membuat index: lebih dari satu semester aktif dalam satu tahun ajaran';
  end if;
end;
$$;

create unique index if not exists academic_years_one_active_per_school_idx
  on public.academic_years(school_id) where is_active;
create unique index if not exists semesters_one_active_per_year_idx
  on public.semesters(school_id, academic_year_id) where is_active;

create or replace function public.validate_academic_year_dates()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.start_date >= new.end_date then
    raise exception 'Tanggal mulai tahun ajaran harus lebih kecil dari tanggal selesai';
  end if;
  if exists (select 1 from public.semesters where academic_year_id = new.id and (start_date < new.start_date or end_date > new.end_date)) then
    raise exception 'Rentang tahun ajaran tidak boleh memotong rentang semester';
  end if;
  return new;
end;
$$;

create or replace function public.validate_semester_dates()
returns trigger language plpgsql set search_path = public
as $$
declare year_start date; year_end date;
begin
  if new.start_date >= new.end_date then
    raise exception 'Tanggal mulai semester harus lebih kecil dari tanggal selesai';
  end if;
  select start_date, end_date into year_start, year_end from public.academic_years where id = new.academic_year_id and school_id = new.school_id;
  if year_start is null then raise exception 'Semester harus menggunakan tahun ajaran dari sekolah yang sama'; end if;
  if new.start_date < year_start or new.end_date > year_end then raise exception 'Tanggal semester harus berada dalam rentang tahun ajaran'; end if;
  return new;
end;
$$;

create or replace function public.prevent_academic_master_school_change()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.school_id is distinct from old.school_id then raise exception 'school_id master akademik tidak dapat dipindahkan'; end if;
  return new;
end;
$$;

create or replace function public.validate_classroom_school_year()
returns trigger language plpgsql set search_path = public
as $$
begin
  if not exists (select 1 from public.academic_years where id = new.academic_year_id and school_id = new.school_id) then
    raise exception 'Rombel harus menggunakan tahun ajaran dari sekolah yang sama';
  end if;
  return new;
end;
$$;

create or replace function public.activate_academic_year(target_year_id uuid)
returns void language plpgsql set search_path = public
as $$
declare target_school_id uuid;
begin
  select school_id into target_school_id from public.academic_years where id = target_year_id;
  if target_school_id is null or not public.has_school_role(target_school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[]) then
    raise exception 'Tidak berwenang mengaktifkan tahun ajaran';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('academic_year:' || target_school_id::text, 0));
  update public.academic_years set is_active = false, updated_at = now() where school_id = target_school_id and id <> target_year_id;
  update public.academic_years set is_active = true, updated_at = now() where id = target_year_id and school_id = target_school_id;
end;
$$;

create or replace function public.activate_semester(target_semester_id uuid)
returns void language plpgsql set search_path = public
as $$
declare target_school_id uuid; target_year_id uuid;
begin
  select school_id, academic_year_id into target_school_id, target_year_id from public.semesters where id = target_semester_id;
  if target_school_id is null or not public.has_school_role(target_school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[]) then
    raise exception 'Tidak berwenang mengaktifkan semester';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('semester:' || target_school_id::text || ':' || target_year_id::text, 0));
  update public.semesters set is_active = false, updated_at = now() where school_id = target_school_id and academic_year_id = target_year_id and id <> target_semester_id;
  update public.semesters set is_active = true, updated_at = now() where id = target_semester_id and school_id = target_school_id and academic_year_id = target_year_id;
end;
$$;

drop trigger if exists academic_year_dates_guard on public.academic_years;
create trigger academic_year_dates_guard before insert or update on public.academic_years for each row execute function public.validate_academic_year_dates();
drop trigger if exists semesters_dates_guard on public.semesters;
create trigger semesters_dates_guard before insert or update on public.semesters for each row execute function public.validate_semester_dates();
drop trigger if exists academic_year_school_identity_guard on public.academic_years;
create trigger academic_year_school_identity_guard before update on public.academic_years for each row execute function public.prevent_academic_master_school_change();
drop trigger if exists semesters_school_identity_guard on public.semesters;
create trigger semesters_school_identity_guard before update on public.semesters for each row execute function public.prevent_academic_master_school_change();
drop trigger if exists classrooms_school_identity_guard on public.classrooms;
create trigger classrooms_school_identity_guard before update on public.classrooms for each row execute function public.prevent_academic_master_school_change();
drop trigger if exists classrooms_school_year_guard on public.classrooms;
create trigger classrooms_school_year_guard before insert or update on public.classrooms for each row execute function public.validate_classroom_school_year();

alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.classrooms enable row level security;

drop policy if exists "active members can view academic years" on public.academic_years;
drop policy if exists "academic admins can manage academic years" on public.academic_years;
drop policy if exists "academic admins can update academic years" on public.academic_years;
drop policy if exists "academic admins can delete academic years" on public.academic_years;
drop policy if exists "active members can view semesters" on public.semesters;
drop policy if exists "academic admins can manage semesters" on public.semesters;
drop policy if exists "academic admins can update semesters" on public.semesters;
drop policy if exists "academic admins can delete semesters" on public.semesters;
drop policy if exists "active members can view classrooms" on public.classrooms;
drop policy if exists "academic admins can insert classrooms" on public.classrooms;
drop policy if exists "academic admins can update classrooms" on public.classrooms;
drop policy if exists "academic admins can delete classrooms" on public.classrooms;

create policy "active members can view academic years" on public.academic_years for select to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator', 'guru']::public.app_role[]));
create policy "academic admins can manage academic years" on public.academic_years for insert to authenticated with check (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[]));
create policy "academic admins can update academic years" on public.academic_years for update to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[])) with check (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[]));
create policy "academic admins can delete academic years" on public.academic_years for delete to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah']::public.app_role[]));
create policy "active members can view semesters" on public.semesters for select to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator', 'guru']::public.app_role[]));
create policy "academic admins can manage semesters" on public.semesters for insert to authenticated with check (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[]));
create policy "academic admins can update semesters" on public.semesters for update to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[])) with check (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[]));
create policy "academic admins can delete semesters" on public.semesters for delete to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah']::public.app_role[]));
create policy "active members can view classrooms" on public.classrooms for select to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator', 'guru']::public.app_role[]));
create policy "academic admins can insert classrooms" on public.classrooms for insert to authenticated with check (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[]));
create policy "academic admins can update classrooms" on public.classrooms for update to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[])) with check (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah', 'operator']::public.app_role[]));
create policy "academic admins can delete classrooms" on public.classrooms for delete to authenticated using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah']::public.app_role[]));

grant select on public.academic_years, public.semesters, public.classrooms to authenticated;
grant insert, update on public.academic_years, public.semesters, public.classrooms to authenticated;
grant delete on public.academic_years, public.semesters, public.classrooms to authenticated;
revoke all on function public.activate_academic_year(uuid) from public;
revoke all on function public.activate_semester(uuid) from public;
grant execute on function public.activate_academic_year(uuid), public.activate_semester(uuid) to authenticated;
