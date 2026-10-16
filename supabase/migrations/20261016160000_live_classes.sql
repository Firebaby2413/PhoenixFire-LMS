-- Live classes for Phoenix Fire LMS.
--
-- course_id is text on purpose. The app still stores courses in the browser
-- with ids such as "course_html". public.courses.id is a uuid, and
-- public.submissions.course_id is already text, so this column matches that.
--
-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/dukkjswxzwacqocdvlur/sql/new

create table if not exists public.live_classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  course_id text not null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60,
  meeting_url text not null,
  recording_url text not null default '',
  host_id uuid references public.profiles (id) on delete set null,
  host_email text not null default '',
  host_name text not null default '',
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_classes_duration_check
    check (duration_minutes between 15 and 240),
  constraint live_classes_status_check
    check (status in ('scheduled', 'cancelled'))
);

create index if not exists live_classes_starts_at_idx
  on public.live_classes (starts_at);

create index if not exists live_classes_course_id_idx
  on public.live_classes (course_id);

create or replace function public.set_live_classes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists live_classes_set_updated_at on public.live_classes;

create trigger live_classes_set_updated_at
  before update on public.live_classes
  for each row
  execute function public.set_live_classes_updated_at();

alter table public.live_classes enable row level security;

grant select, insert, update, delete on table public.live_classes to anon, authenticated;

-- The academy screen still signs in with browser accounts, and the app key
-- can already read public.submissions. These policies let that same key
-- read and write the schedule. Replace them with the role policies below
-- once every login is a Supabase Auth session.

drop policy if exists live_classes_select on public.live_classes;
create policy live_classes_select
  on public.live_classes
  for select
  to anon, authenticated
  using (true);

drop policy if exists live_classes_insert on public.live_classes;
create policy live_classes_insert
  on public.live_classes
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists live_classes_update on public.live_classes;
create policy live_classes_update
  on public.live_classes
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists live_classes_delete on public.live_classes;
create policy live_classes_delete
  on public.live_classes
  for delete
  to anon, authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.live_classes;
exception
  when duplicate_object then
    null;
end $$;

-- Stricter policies for when sign-in uses Supabase Auth and public.profiles.
-- Drop the four policies above, then run this block.
--
-- create policy live_classes_select
--   on public.live_classes
--   for select
--   to authenticated
--   using (true);
--
-- create policy live_classes_insert
--   on public.live_classes
--   for insert
--   to authenticated
--   with check (
--     exists (
--       select 1 from public.profiles
--       where id = auth.uid()
--         and role in ('mentor', 'instructor', 'admin')
--     )
--   );
--
-- create policy live_classes_update
--   on public.live_classes
--   for update
--   to authenticated
--   using (
--     host_id = auth.uid()
--     or exists (
--       select 1 from public.profiles
--       where id = auth.uid()
--         and role in ('mentor', 'instructor', 'admin')
--     )
--   )
--   with check (
--     host_id = auth.uid()
--     or exists (
--       select 1 from public.profiles
--       where id = auth.uid()
--         and role in ('mentor', 'instructor', 'admin')
--     )
--   );
--
-- create policy live_classes_delete
--   on public.live_classes
--   for delete
--   to authenticated
--   using (
--     host_id = auth.uid()
--     or exists (
--       select 1 from public.profiles
--       where id = auth.uid()
--         and role = 'admin'
--     )
--   );
