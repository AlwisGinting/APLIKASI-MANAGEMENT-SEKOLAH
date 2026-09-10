-- Semester defaults and role-aware semester name editing.
-- Apply after 202609110003_academic_master_data.sql.
-- The 2026/2027 dates are an application default, not a claim about every
-- school's official calendar. All dates remain editable by authorized roles.

-- ON CONFLICT below requires this invariant before any helper is called.
do $$
begin
  if exists (
    select 1
    from public.semesters
    group by school_id, academic_year_id, name
    having count(*) > 1
  ) then
    raise exception 'Tidak dapat membuat unique semester name: ditemukan duplicate school_id, academic_year_id, name';
  end if;
end;
$$;

create unique index if not exists semesters_school_year_name_uidx
  on public.semesters(school_id, academic_year_id, name);

create or replace function public.ensure_default_semesters(
  target_school_id uuid,
  target_year_id uuid,
  target_year_name text,
  target_start_date date,
  target_end_date date,
  target_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  first_start date := target_start_date;
  first_end date;
  second_start date;
  second_end date := target_end_date;
  midpoint date;
  first_active boolean := false;
  existing_active boolean;
begin
  if target_end_date <= target_start_date then
    raise exception 'Rentang tahun ajaran tidak valid untuk semester default';
  end if;

  if target_year_name = '2026/2027' then
    first_start := date '2026-07-13';
    first_end := date '2026-12-18';
    second_start := date '2027-01-04';
    second_end := date '2027-06-18';
    if target_start_date > first_start or target_end_date < second_end then
      raise exception 'Tahun ajaran 2026/2027 harus mencakup rentang preset 2026-07-13 sampai 2027-06-18';
    end if;
  else
    -- Fallback only: this is not an official calendar. It remains editable.
    if target_end_date - target_start_date < 3 then
      raise exception 'Rentang tahun ajaran terlalu pendek untuk dua semester default';
    end if;
    midpoint := target_start_date + ((target_end_date - target_start_date + 1) / 2);
    first_end := midpoint - 1;
    second_start := midpoint;
  end if;

  select exists (
    select 1 from public.semesters
    where school_id = target_school_id
      and academic_year_id = target_year_id
      and is_active
  ) into existing_active;
  first_active := target_is_active and not existing_active;

  insert into public.semesters (school_id, academic_year_id, name, start_date, end_date, is_active)
  values
    (target_school_id, target_year_id, 'Ganjil', first_start, first_end, first_active),
    (target_school_id, target_year_id, 'Genap', second_start, second_end, false)
  on conflict (school_id, academic_year_id, name) do nothing;
end;
$$;

create or replace function public.create_default_semesters_for_year()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_default_semesters(new.school_id, new.id, new.name, new.start_date, new.end_date, new.is_active);
  return new;
end;
$$;

drop trigger if exists academic_year_default_semesters on public.academic_years;
create trigger academic_year_default_semesters
after insert on public.academic_years
for each row execute function public.create_default_semesters_for_year();

create or replace function public.prevent_non_super_admin_semester_name_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name
    and not public.has_school_role(old.school_id, array['super_admin']::public.app_role[]) then
    raise exception 'Hanya super_admin yang dapat mengubah nama semester';
  end if;
  return new;
end;
$$;

drop trigger if exists semesters_name_role_guard on public.semesters;
create trigger semesters_name_role_guard
before update on public.semesters
for each row execute function public.prevent_non_super_admin_semester_name_change();

-- Backfill defaults for existing years without overwriting existing semesters.
do $$
declare year_record record;
begin
  for year_record in
    select id, school_id, name, start_date, end_date, is_active
    from public.academic_years
  loop
    perform public.ensure_default_semesters(
      year_record.school_id,
      year_record.id,
      year_record.name,
      year_record.start_date,
      year_record.end_date,
      year_record.is_active
    );
  end loop;
end;
$$;

-- Trigger/helper functions are not an API surface. Keep them inaccessible to
-- PUBLIC, anon, and authenticated; the trigger invokes them internally.
revoke all on function public.ensure_default_semesters(uuid, uuid, text, date, date, boolean) from public;
revoke all on function public.ensure_default_semesters(uuid, uuid, text, date, date, boolean) from anon;
revoke all on function public.ensure_default_semesters(uuid, uuid, text, date, date, boolean) from authenticated;
revoke all on function public.create_default_semesters_for_year() from public;
revoke all on function public.create_default_semesters_for_year() from anon;
revoke all on function public.create_default_semesters_for_year() from authenticated;
revoke all on function public.prevent_non_super_admin_semester_name_change() from public;
revoke all on function public.prevent_non_super_admin_semester_name_change() from anon;
revoke all on function public.prevent_non_super_admin_semester_name_change() from authenticated;
