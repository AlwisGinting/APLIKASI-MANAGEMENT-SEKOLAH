-- REVIEW ONLY: not applied by the assistant.
-- Independent of feedback migration 005; requires foundation/auth 001-002.
-- Adds public-within-tenant school profile fields, not confidential records.
begin;

alter table public.schools
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists principal_name text,
  add column if not exists npsn text,
  add column if not exists description text,
  add column if not exists vision text,
  add column if not exists mission text,
  add column if not exists logo_path text;

alter table public.schools drop constraint if exists school_profile_text_limits;
alter table public.schools
  add constraint school_profile_text_limits check (
    (address is null or char_length(address) <= 1000)
    and (phone is null or char_length(phone) <= 40)
    and (email is null or char_length(email) <= 254)
    and (principal_name is null or char_length(principal_name) <= 200)
    and (npsn is null or npsn ~ '^[0-9]{8}$')
    and (description is null or char_length(description) <= 3000)
    and (vision is null or char_length(vision) <= 3000)
    and (mission is null or char_length(mission) <= 3000)
    and (logo_path is null or char_length(logo_path) <= 1000)
  );

create or replace function public.protect_school_profile_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.name := btrim(new.name);
  new.address := nullif(btrim(new.address), '');
  new.phone := nullif(btrim(new.phone), '');
  new.email := nullif(btrim(new.email), '');
  new.principal_name := nullif(btrim(new.principal_name), '');
  new.npsn := nullif(btrim(new.npsn), '');
  new.description := nullif(btrim(new.description), '');
  new.vision := nullif(btrim(new.vision), '');
  new.mission := nullif(btrim(new.mission), '');

  if new.id is distinct from old.id
    or new.slug is distinct from old.slug
    or new.is_active is distinct from old.is_active
    or new.created_at is distinct from old.created_at
    or new.logo_path is distinct from old.logo_path then
    raise exception 'Identitas dan lifecycle sekolah tidak dapat diubah melalui profil';
  end if;
  if new.name is null or new.name = '' or char_length(new.name) > 200 then
    raise exception 'Nama sekolah tidak valid';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists schools_profile_update_guard on public.schools;
create trigger schools_profile_update_guard
before update on public.schools
for each row execute function public.protect_school_profile_update();

revoke all on function public.protect_school_profile_update() from public, anon, authenticated;
alter table public.schools enable row level security;
drop policy if exists "school admins can edit school profile" on public.schools;
create policy "school admins can edit school profile"
on public.schools for update to authenticated
using (public.has_school_role(id, array['super_admin', 'kepala_sekolah']::public.app_role[]))
with check (public.has_school_role(id, array['super_admin', 'kepala_sekolah']::public.app_role[]));

-- No operator edit, no browser-controlled id, slug, active flag or timestamps.
revoke update on public.schools from authenticated;
grant update (name, address, phone, email, principal_name, npsn, description, vision, mission)
on public.schools to authenticated;

-- logo_path is reserved; uploads/changes await owner- and bucket-scoped Storage policies.
commit;
