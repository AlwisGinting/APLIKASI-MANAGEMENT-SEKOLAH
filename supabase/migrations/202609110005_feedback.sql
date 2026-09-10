-- Global feedback for authenticated school members.
-- Apply after 202609110004_semester_defaults.sql.

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  type text not null,
  title text not null,
  message text not null,
  current_path text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_type_valid check (type in ('suggestion', 'bug', 'complaint', 'other')),
  constraint feedback_status_valid check (status in ('open', 'in_progress', 'resolved', 'closed')),
  constraint feedback_title_not_blank check (length(btrim(title)) > 0),
  constraint feedback_message_not_blank check (length(btrim(message)) > 0),
  constraint feedback_title_length check (char_length(title) <= 200),
  constraint feedback_message_length check (char_length(message) <= 5000),
  constraint feedback_current_path_length check (current_path is null or char_length(current_path) <= 1000)
);

alter table public.feedbacks
  drop constraint if exists feedback_title_length,
  drop constraint if exists feedback_message_length,
  drop constraint if exists feedback_current_path_length;
alter table public.feedbacks
  add constraint feedback_title_length check (char_length(title) <= 200),
  add constraint feedback_message_length check (char_length(message) <= 5000),
  add constraint feedback_current_path_length check (current_path is null or char_length(current_path) <= 1000);

alter table public.feedbacks
  drop constraint if exists feedbacks_user_id_fkey;
alter table public.feedbacks
  add constraint feedbacks_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;

create or replace function public.protect_feedback_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.school_id is distinct from old.school_id
    or new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.current_path is distinct from old.current_path
    or new.created_at is distinct from old.created_at then
    raise exception 'Isi feedback tidak dapat diubah setelah dibuat';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists feedback_content_guard on public.feedbacks;
create trigger feedback_content_guard
before update on public.feedbacks
for each row execute function public.protect_feedback_content();

revoke all on function public.protect_feedback_content() from public;
revoke all on function public.protect_feedback_content() from anon;
revoke all on function public.protect_feedback_content() from authenticated;

create index if not exists feedbacks_school_created_idx on public.feedbacks(school_id, created_at desc);
create index if not exists feedbacks_school_status_idx on public.feedbacks(school_id, status);
create index if not exists feedbacks_school_type_idx on public.feedbacks(school_id, type);
create index if not exists feedbacks_user_created_idx on public.feedbacks(user_id, created_at desc);

alter table public.feedbacks enable row level security;

drop policy if exists "active members can create own feedback" on public.feedbacks;
drop policy if exists "members can view own feedback" on public.feedbacks;
drop policy if exists "school admins can view feedback" on public.feedbacks;
drop policy if exists "school admins can update feedback" on public.feedbacks;
drop policy if exists "super admins can delete feedback" on public.feedbacks;

create policy "active members can create own feedback"
on public.feedbacks for insert to authenticated
with check (user_id = auth.uid() and public.is_school_member(school_id));

create policy "members can view own feedback"
on public.feedbacks for select to authenticated
using (user_id = auth.uid() and public.is_school_member(school_id));

create policy "school admins can view feedback"
on public.feedbacks for select to authenticated
using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah']::public.app_role[]));

create policy "school admins can update feedback"
on public.feedbacks for update to authenticated
using (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah']::public.app_role[]))
with check (public.has_school_role(school_id, array['super_admin', 'kepala_sekolah']::public.app_role[]));

create policy "super admins can delete feedback"
on public.feedbacks for delete to authenticated
using (public.has_school_role(school_id, array['super_admin']::public.app_role[]));

revoke all on public.feedbacks from anon;
grant select, insert on public.feedbacks to authenticated;
grant update on public.feedbacks to authenticated;
grant delete on public.feedbacks to authenticated;
