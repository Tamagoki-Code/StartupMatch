-- The previous version of this trigger reverted role/verification_status on
-- EVERY update where is_admin() was false — but is_admin() reads auth.uid(),
-- which is NULL for migrations and other direct/service-role DB connections
-- (no user JWT in that context). That silently undid legitimate admin-side
-- fixes run via `supabase db push`. Only guard updates made by a real
-- authenticated client (auth.uid() is not null); a null auth.uid() means
-- there's no RLS-bypassing end user to protect against in the first place.

create or replace function public.protect_profile_role_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.verification_status := old.verification_status;
  end if;
  return new;
end;
$$;
