-- Auto-create a profiles row (+ role-specific row) whenever a new
-- auth.users row is inserted. Runs as SECURITY DEFINER so it isn't blocked
-- by RLS, and fires even before the user confirms their email (needed since
-- there's no authenticated session yet at that point for the client to
-- insert its own profile row).
--
-- Role and extra fields are passed from the client via
-- supabase.auth.signUp({ options: { data: {...} } }), which lands in
-- new.raw_user_meta_data.

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
    insert into public.student_profiles (profile_id)
    values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
