-- The Academic ID Number collected at student sign-up was never stored —
-- signUpUser() only forwarded the id-number field for enterprise accounts
-- (as `permit`), so students' IDs were silently discarded. Add a column and
-- have the signup trigger store it, same as the enterprise `permit` path.

alter table student_profiles add column academic_id text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role user_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::user_role,
    'student'
  );
  display_name text := coalesce(new.raw_user_meta_data ->> 'name', new.email);
begin
  insert into public.profiles (id, role, name, email, initials, verification_status)
  values (
    new.id,
    chosen_role,
    display_name,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'initials',
      upper(left(regexp_replace(display_name, '[^A-Za-z ]', '', 'g'), 2))
    ),
    case when chosen_role = 'admin' then 'Verified'::verification_status else 'Pending Review'::verification_status end
  );

  if chosen_role = 'enterprise' then
    insert into public.enterprise_profiles (profile_id, business, permit)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'business', ''),
      new.raw_user_meta_data ->> 'permit'
    );
  else
    insert into public.student_profiles (profile_id, academic_id)
    values (new.id, new.raw_user_meta_data ->> 'academic_id');
  end if;

  return new;
end;
$$;
