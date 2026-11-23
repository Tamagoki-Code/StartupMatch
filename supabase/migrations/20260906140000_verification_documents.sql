-- Registration never actually collected a photo of the student ID / business
-- permit it asks about — only a typed ID number. Add somewhere to store an
-- uploaded document's URL (hosted on Cloudinary) so admins can look at
-- something before verifying an account, instead of vetting blind.
--
-- This lives in its own table, not on `profiles` — profiles is readable by
-- any signed-in user (it backs the public marketplace listings), so a
-- verification document has to be locked down separately: owner or admin
-- only.

create table verification_documents (
  profile_id uuid primary key references profiles (id) on delete cascade,
  document_url text not null,
  uploaded_at timestamptz not null default now()
);

alter table verification_documents enable row level security;

create policy "verification documents readable by owner or admin" on verification_documents
  for select to authenticated using (profile_id = auth.uid() or is_admin());

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

  if doc_url is not null then
    insert into public.verification_documents (profile_id, document_url)
    values (new.id, doc_url);
  end if;

  return new;
end;
$$;
