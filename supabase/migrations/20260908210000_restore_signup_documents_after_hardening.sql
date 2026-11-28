-- 20260908090000_close_admin_privilege_escalation rewrote handle_new_user()
-- from a version older than 20260906130000 / 20260906140000 / 20260907090000,
-- so it silently stopped saving academic_id, the verification document and
-- the establishment photo at signup. This keeps that hardening (admin can
-- never be self-assigned, always starts as Pending Review) and restores the
-- three dropped behaviours.

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
  doc_url text := new.raw_user_meta_data ->> 'document_url';
  establishment_url text := new.raw_user_meta_data ->> 'establishment_photo_url';
begin
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
    insert into public.student_profiles (profile_id, academic_id)
    values (new.id, new.raw_user_meta_data ->> 'academic_id');
  end if;

  if doc_url is not null or establishment_url is not null then
    insert into public.verification_documents (profile_id, document_url, establishment_photo_url)
    values (new.id, doc_url, establishment_url);
  end if;

  return new;
end;
$$;
