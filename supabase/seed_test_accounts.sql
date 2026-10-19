-- Test accounts for Phoenix Fire LMS.
-- Paste this whole file into the Supabase SQL editor and run it:
-- https://supabase.com/dashboard/project/dukkjswxzwacqocdvlur/sql/new
--
-- Insert only. If an email already exists, that account is left unchanged.
--
-- michaelstudent@test.com  student  MichaelRocks!
-- michaelmentor@test.com   mentor   MichaelRocks!
-- michaeladmin@test.com    admin    MichaelRocks!

do $$
declare
  accounts text[][] := array[
    array['michaelstudent@test.com', 'MichaelRocks!', 'student', 'Michael', 'Student', 'STU-MICHAEL'],
    array['michaelmentor@test.com', 'MichaelRocks!', 'mentor', 'Michael', 'Mentor', 'MEN-MICHAEL'],
    array['michaeladmin@test.com', 'MichaelRocks!', 'admin', 'Michael', 'Admin', 'ADM-MICHAEL']
  ];
  account text[];
  v_email text;
  v_user_id uuid;
  v_meta jsonb;
begin
  foreach account slice 1 in array accounts loop
    v_email := lower(account[1]);

    if exists (select 1 from auth.users where lower(email) = v_email) then
      raise notice 'Left % unchanged; that email already exists.', v_email;
      continue;
    end if;

    v_user_id := gen_random_uuid();
    v_meta := jsonb_build_object(
      'first_name', account[4],
      'last_name', account[5],
      'role', account[3],
      'student_id', account[6]
    );

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(account[2], extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    select
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    where not exists (
      select 1
      from auth.identities
      where user_id = v_user_id
        and provider = 'email'
    );

    insert into public.profiles (
      id,
      email,
      role,
      first_name,
      last_name,
      student_id
    )
    select
      v_user_id,
      v_email,
      account[3],
      account[4],
      account[5],
      account[6]
    where not exists (
      select 1 from public.profiles where id = v_user_id
    );
  end loop;
end $$;

select u.email, p.role, p.first_name, p.last_name, p.student_id
from auth.users u
join public.profiles p on p.id = u.id
where u.email in (
  'michaelstudent@test.com',
  'michaelmentor@test.com',
  'michaeladmin@test.com'
)
order by p.role;
