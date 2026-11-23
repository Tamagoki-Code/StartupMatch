-- Closes two privilege-escalation holes found in audit:
-- 1) signup trusted client-supplied `role: 'admin'` and auto-verified it
-- 2) the `profiles` UPDATE policy had no column check, so any signed-in
--    user could set their own role/verification_status to admin/Verified

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
  -- admin can never be granted via client-controlled signup metadata
  if chosen_role = 'admin' then
    chosen_role := 'student';
  end if;

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
    'Pending Review'::verification_status
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

-- Non-admins keep their own role/verification_status unchanged on update,
-- no matter what the UPDATE statement asked for. Admins (via admin.ts
-- setVerificationStatus/promoteToAdmin) are unaffected.
create or replace function public.protect_profile_role_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.verification_status := old.verification_status;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_fields on public.profiles;
create trigger protect_profile_role_fields
  before update on public.profiles
  for each row execute function public.protect_profile_role_fields();
