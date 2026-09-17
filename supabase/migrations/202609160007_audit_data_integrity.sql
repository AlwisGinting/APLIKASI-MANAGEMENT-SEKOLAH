-- REVIEW ONLY: not applied by the assistant. Requires applied migrations 001–006.
-- No backfill: audit begins only after this transaction is applied manually.
begin;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  -- Historical principal reference, intentionally NO FK: account deletion must
  -- neither erase audit nor mutate an append-only row via ON DELETE SET NULL.
  -- NULL means no authenticated principal (trusted system/database operation).
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  -- Logical reference: the source record may have been deleted.
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_action_format check (action ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$' and char_length(action) <= 100),
  constraint audit_entity_format check (entity_type ~ '^[a-z][a-z0-9_]*$' and char_length(entity_type) <= 60),
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
  constraint audit_metadata_keys check (
    metadata - array['changed_fields', 'old_status', 'new_status', 'old_role', 'new_role']::text[] = '{}'::jsonb
  )
);

create index audit_logs_school_created_idx on public.audit_logs(school_id, created_at desc, id desc);
create index audit_logs_school_entity_idx on public.audit_logs(school_id, entity_type, entity_id, created_at desc);

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated;
grant select on public.audit_logs to authenticated;
create policy "school admins can read tenant audit"
on public.audit_logs for select to authenticated
using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah']::public.app_role[]));
-- No INSERT/UPDATE/DELETE policies or grants for browser roles.

create function public.guard_audit_log()
returns trigger language plpgsql set search_path = pg_catalog
as $$
begin
  if TG_OP <> 'INSERT' then
    raise exception 'Audit log bersifat append-only';
  end if;
  if TG_TABLE_SCHEMA <> 'public' or TG_TABLE_NAME <> 'audit_logs'
    or TG_WHEN <> 'BEFORE' or TG_LEVEL <> 'ROW' then
    raise exception 'Konteks audit tidak valid';
  end if;
  new.actor_user_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

create trigger audit_logs_stamp
before insert on public.audit_logs
for each row execute function public.guard_audit_log();
create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.guard_audit_log();
revoke all on function public.guard_audit_log() from public, anon, authenticated;

-- SECURITY DEFINER is required solely to append audit without giving clients
-- INSERT privilege and to resolve memberships for global profile changes.
-- No callable writer API, dynamic SQL, user-controlled search_path, or recursion.
create function public.capture_foundation_audit()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare
  before_row jsonb := '{}'::jsonb;
  after_row jsonb := '{}'::jsonb;
  source_row jsonb;
  fields text[];
  changed_fields text[] := array[]::text[];
  field_name text;
  entity_name text;
  event_action text;
  event_metadata jsonb := '{}'::jsonb;
  tenant_id uuid;
  record_id uuid;
  role_changed boolean := false;
begin
  if TG_TABLE_SCHEMA <> 'public' or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then
    raise exception 'Konteks audit tidak valid';
  end if;
  -- Table allowlist also prevents accidental use on audit_logs itself.
  case TG_TABLE_NAME
    when 'profiles' then
      entity_name := 'profile'; fields := array['full_name', 'phone', 'avatar_path'];
    when 'schools' then
      entity_name := 'school'; fields := array['name', 'address', 'phone', 'email', 'principal_name', 'npsn', 'description', 'vision', 'mission', 'logo_path'];
    when 'school_memberships' then
      entity_name := 'membership'; fields := array['status', 'role'];
    when 'academic_years' then
      entity_name := 'academic_year'; fields := array['name', 'start_date', 'end_date', 'is_active'];
    when 'semesters' then
      entity_name := 'semester'; fields := array['academic_year_id', 'name', 'start_date', 'end_date', 'is_active'];
    when 'classrooms' then
      entity_name := 'classroom'; fields := array['academic_year_id', 'name', 'code', 'level', 'capacity', 'description', 'is_active'];
    when 'feedbacks' then
      entity_name := 'feedback'; fields := array['status'];
    else raise exception 'Sumber audit tidak didukung';
  end case;

  -- Row JSON is transient for comparison only. Never persist raw row values.
  if TG_OP <> 'INSERT' then before_row := to_jsonb(old); end if;
  if TG_OP <> 'DELETE' then after_row := to_jsonb(new); end if;
  source_row := case when TG_OP = 'INSERT' then after_row else before_row end;
  record_id := (source_row ->> 'id')::uuid;

  if TG_OP = 'UPDATE' then
    -- An identity-only rewrite must not disappear through the no-op filter.
    if before_row -> 'id' is distinct from after_row -> 'id'
      or before_row -> 'school_id' is distinct from after_row -> 'school_id' then
      raise exception 'Identitas dan tenant sumber audit tidak dapat diubah';
    end if;
    foreach field_name in array fields loop
      if before_row -> field_name is distinct from after_row -> field_name then
        changed_fields := array_append(changed_fields, field_name);
      end if;
    end loop;
    -- Ignore timestamp-only/no-op writes (including activation RPC fanout).
    if cardinality(changed_fields) = 0 then return null; end if;
    event_metadata := jsonb_build_object('changed_fields', changed_fields);
  end if;

  event_action := entity_name || case TG_OP when 'INSERT' then '.created' when 'DELETE' then '.deleted' else '.updated' end;
  if TG_TABLE_NAME = 'school_memberships' and TG_OP = 'UPDATE' then
    if before_row -> 'status' is distinct from after_row -> 'status' then
      event_action := 'membership.' || case after_row ->> 'status'
        when 'active' then 'approved' when 'rejected' then 'rejected'
        when 'suspended' then 'suspended' else 'updated' end;
      event_metadata := jsonb_build_object('changed_fields', array['status'],
        'old_status', before_row -> 'status', 'new_status', after_row -> 'status');
      -- A simultaneous role change gets its own event, never status metadata.
      role_changed := before_row -> 'role' is distinct from after_row -> 'role';
    else
      -- The no-op filter guarantees this branch is a role-only change.
      event_action := 'membership.role_changed';
      event_metadata := jsonb_build_object('changed_fields', array['role'],
        'old_role', before_row -> 'role', 'new_role', after_row -> 'role');
    end if;
  elsif TG_TABLE_NAME in ('academic_years', 'semesters') and TG_OP = 'UPDATE'
    and before_row -> 'is_active' is distinct from after_row -> 'is_active' then
    event_action := entity_name || case when (after_row ->> 'is_active')::boolean then '.activated' else '.deactivated' end;
  elsif TG_TABLE_NAME = 'feedbacks' and TG_OP = 'UPDATE' then
    event_action := 'feedback.status_changed';
    event_metadata := event_metadata || jsonb_build_object('old_status', before_row -> 'status', 'new_status', after_row -> 'status');
  end if;

  if TG_TABLE_NAME = 'profiles' then
    -- Profiles have no authoritative single school. Record only changed field
    -- names in EVERY active membership of the subject; never trust a cookie/GUC.
    for tenant_id in
      select m.school_id from public.school_memberships m
      where m.user_id = record_id and m.status = 'active'::public.membership_status
    loop
      insert into public.audit_logs(school_id, actor_user_id, action, entity_type, entity_id, metadata)
      values (tenant_id, auth.uid(), event_action, entity_name, record_id, event_metadata);
    end loop;
  else
    tenant_id := case when TG_TABLE_NAME = 'schools' then record_id else (source_row ->> 'school_id')::uuid end;
    insert into public.audit_logs(school_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (tenant_id, auth.uid(), event_action, entity_name, record_id, event_metadata);
    if role_changed then
      insert into public.audit_logs(school_id, actor_user_id, action, entity_type, entity_id, metadata)
      values (tenant_id, auth.uid(), 'membership.role_changed', entity_name, record_id,
        jsonb_build_object('changed_fields', array['role'], 'old_role', before_row -> 'role', 'new_role', after_row -> 'role'));
    end if;
  end if;
  -- AFTER trigger result is ignored. Do not swallow audit failures: rollback
  -- source mutation and audit together, including nested default semesters.
  return null;
end;
$$;
revoke all on function public.capture_foundation_audit() from public, anon, authenticated;

-- Coexist with all 001–006 BEFORE guards and AFTER auth/default triggers.
-- No audit for profile creation/login/password/session/token events.
create trigger profiles_audit after update on public.profiles
for each row execute function public.capture_foundation_audit();
create trigger schools_audit after update on public.schools
for each row execute function public.capture_foundation_audit();
create trigger school_memberships_audit after update on public.school_memberships
for each row execute function public.capture_foundation_audit();
create trigger academic_years_audit after insert or update or delete on public.academic_years
for each row execute function public.capture_foundation_audit();
create trigger semesters_audit after insert or update or delete on public.semesters
for each row execute function public.capture_foundation_audit();
create trigger classrooms_audit after insert or update or delete on public.classrooms
for each row execute function public.capture_foundation_audit();
create trigger feedbacks_audit after insert or update or delete on public.feedbacks
for each row execute function public.capture_foundation_audit();

-- Application roles cannot use TRUNCATE to bypass row-trigger audit.
-- Privileged owner/maintenance operations are outside the normal audit trail;
-- no TRUNCATE triggers restrict maintenance. Audit is not a database backup.
revoke truncate on public.audit_logs, public.profiles, public.schools, public.school_memberships,
  public.academic_years, public.semesters, public.classrooms, public.feedbacks
from public, anon, authenticated;

commit;
