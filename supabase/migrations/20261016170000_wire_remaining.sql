-- Columns and tables for accounts, courses, messages, progress, and settings.
-- profiles, courses, submissions, and module_progress already exist.
-- Run supabase/migrations/20261016160000_live_classes.sql before this file.
-- In Authentication settings, turn off "Confirm email" while building.

alter table public.profiles
  add column if not exists email text;

alter table public.courses
  add column if not exists mentor_key text not null default '',
  add column if not exists assigned_student_keys jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'draft';

alter table public.module_progress
  add column if not exists is_watched boolean not null default false,
  add column if not exists is_submitted boolean not null default false,
  add column if not exists quiz_result jsonb;

do $$
begin
  alter table public.module_progress
    add constraint module_progress_student_module_key unique (student_id, module_id);
exception
  when duplicate_table then null;
  when duplicate_object then null;
end $$;

create table if not exists public.academy_settings (
  id integer primary key default 1,
  academy_name text not null,
  owner_key text not null,
  enrollment_key text not null,
  constraint academy_settings_one_row check (id = 1)
);

insert into public.academy_settings (id, academy_name, owner_key, enrollment_key)
values (1, 'Phoenix Fire Technical Academy', 'FireKey-Creation-2026', 'FireKey-Enroll-2026')
on conflict (id) do nothing;

create or replace function public.account_key_is_valid(requested_role text, submitted_key text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select case
    when requested_role = 'admin'
      then submitted_key = (select owner_key from public.academy_settings where id = 1)
    else submitted_key = (select enrollment_key from public.academy_settings where id = 1)
  end;
$$;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_name text not null default '',
  notify_passed boolean not null default true,
  notify_revision boolean not null default true,
  notify_message boolean not null default true,
  feedback_snippets text not null default ''
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.notify_user(target_user uuid, note_type text, note_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user is null or note_message is null or length(trim(note_message)) = 0 then
    return;
  end if;
  insert into public.notifications (user_id, type, message)
  values (target_user, coalesce(note_type, 'message'), note_message);
end;
$$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  certificate_key text not null,
  awarded_at timestamptz not null default now(),
  unique (student_id, certificate_key)
);

create index if not exists messages_pair_idx
  on public.messages (sender_id, receiver_id, created_at);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.academy_settings enable row level security;
alter table public.user_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;
alter table public.certificates enable row level security;
alter table public.profiles enable row level security;
alter table public.courses enable row level security;

grant select, insert, update, delete on public.academy_settings to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.certificates to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
grant execute on function public.account_key_is_valid(text, text) to anon, authenticated;
grant execute on function public.notify_user(uuid, text, text) to authenticated;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.current_role() = 'admin')
  with check (id = auth.uid() or public.current_role() = 'admin');

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select to authenticated
  using (
    published = true
    or status = 'published'
    or public.current_role() in ('mentor', 'instructor', 'admin', 'ta')
  );

drop policy if exists courses_write on public.courses;
create policy courses_write on public.courses
  for all to authenticated
  using (public.current_role() in ('mentor', 'instructor', 'admin', 'ta'))
  with check (public.current_role() in ('mentor', 'instructor', 'admin'));

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    sender_id = auth.uid()
    or receiver_id = auth.uid()
    or public.current_role() in ('mentor', 'instructor', 'admin', 'ta')
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists prefs_own on public.user_preferences;
create policy prefs_own on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists settings_admin on public.academy_settings;
create policy settings_admin on public.academy_settings
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.current_role() in ('mentor', 'instructor', 'admin', 'ta')
  );

drop policy if exists certificates_write on public.certificates;
create policy certificates_write on public.certificates
  for insert to authenticated
  with check (
    student_id = auth.uid()
    or public.current_role() in ('mentor', 'instructor', 'admin')
  );

drop policy if exists certificates_update on public.certificates;
create policy certificates_update on public.certificates
  for update to authenticated
  using (
    student_id = auth.uid()
    or public.current_role() in ('mentor', 'instructor', 'admin')
  )
  with check (
    student_id = auth.uid()
    or public.current_role() in ('mentor', 'instructor', 'admin')
  );
