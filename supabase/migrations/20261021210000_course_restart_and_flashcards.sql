-- Course restart requests (admin approval) and student-owned flashcards.
-- Paste this whole file into the Supabase SQL editor and run it:
-- https://supabase.com/dashboard/project/dukkjswxzwacqocdvlur/sql/new

create table if not exists public.course_restart_requests (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  student_email text not null default '',
  student_name text not null default '',
  course_id text not null,
  course_title text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  constraint course_restart_status_check
    check (status in ('pending', 'approved', 'denied'))
);

create unique index if not exists course_restart_one_pending
  on public.course_restart_requests (student_id, course_id)
  where status = 'pending';

create table if not exists public.student_flashcards (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  course_id text not null,
  lesson_id text not null,
  front text not null default '',
  back text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_flashcards_owner_idx
  on public.student_flashcards (student_id, course_id, lesson_id);

alter table public.course_restart_requests enable row level security;
alter table public.student_flashcards enable row level security;

grant select, insert, update on public.course_restart_requests to authenticated;
grant select, insert, update, delete on public.student_flashcards to authenticated;

drop policy if exists restart_select on public.course_restart_requests;
create policy restart_select on public.course_restart_requests
  for select to authenticated
  using (
    student_id = auth.uid()::text
    or public.current_role() = 'admin'
  );

drop policy if exists restart_insert on public.course_restart_requests;
create policy restart_insert on public.course_restart_requests
  for insert to authenticated
  with check (
    student_id = auth.uid()::text
    and status = 'pending'
  );

drop policy if exists restart_admin_update on public.course_restart_requests;
create policy restart_admin_update on public.course_restart_requests
  for update to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists certificates_delete on public.certificates;
create policy certificates_delete on public.certificates
  for delete to authenticated
  using (
    student_id = auth.uid()
    or public.current_role() = 'admin'
  );

drop policy if exists student_flashcards_own on public.student_flashcards;
create policy student_flashcards_own on public.student_flashcards
  for all to authenticated
  using (student_id = auth.uid()::text)
  with check (student_id = auth.uid()::text);

create or replace function public.approve_course_restart(
  request_id uuid,
  module_ids text[] default array[]::text[],
  certificate_keys text[] default array[]::text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.course_restart_requests%rowtype;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Only an admin can approve a course restart';
  end if;

  select * into req
  from public.course_restart_requests
  where id = request_id;

  if req.id is null then
    raise exception 'Restart request not found';
  end if;

  if req.status = 'denied' then
    raise exception 'This request was denied';
  end if;

  delete from public.module_progress
  where module_id::text = any(module_ids)
    and (
      student_id::text = req.student_id
      or (
        req.student_email <> ''
        and lower(student_id::text) = lower(req.student_email)
      )
    );

  delete from public.submissions
  where (
      student_id::text = req.student_id
      or (
        req.student_email <> ''
        and lower(student_id::text) = lower(req.student_email)
      )
    )
    and (
      course_id::text = req.course_id
      or module_id::text = any(module_ids)
    );

  -- The live certificates table was created before certificate_key existed.
  -- Add it here so this delete does not abort the whole restart.
  if to_regclass('public.certificates') is not null then
    execute 'alter table public.certificates add column if not exists certificate_key text';
    execute
      'delete from public.certificates
       where student_id::text = $1
         and certificate_key = any($2)'
      using req.student_id, certificate_keys;
  end if;

  update public.course_restart_requests
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = req.id;
end;
$$;

grant execute on function public.approve_course_restart(uuid, text[], text[]) to authenticated;
