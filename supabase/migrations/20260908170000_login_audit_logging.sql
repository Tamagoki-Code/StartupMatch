-- Thesis dataflow spec: every login attempt (success and failure) should be
-- recorded, with a timestamp on success. A successful sign-in always inserts
-- a row into Supabase's own auth.sessions table, so a trigger there is a
-- genuine "this really happened" signal, same spirit as the rest of
-- audit_log's triggers. A failed attempt never writes anything (GoTrue
-- rejects it before any row exists), so there's no table to trigger off —
-- logging that side has to be a direct, SECURITY DEFINER call the client
-- makes on a caught sign-in error, open to anon since the user isn't
-- authenticated yet at that point.

create or replace function public.audit_login_success()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role text;
begin
  select name, role into v_name, v_role from profiles where id = new.user_id;
  if v_name is null then
    return new; -- no profile yet (shouldn't happen post-signup, fail open)
  end if;
  perform log_audit_event(
    v_name || ' Signed In',
    'info',
    case v_role
      when 'admin' then 'Platform Admin'
      when 'enterprise' then 'Enterprise Client'
      when 'student' then 'Student Developer'
      else 'System'
    end
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_login_success on auth.sessions;
create trigger trg_audit_login_success
  after insert on auth.sessions
  for each row
  execute function audit_login_success();

-- Callable pre-auth (no profile, no auth.uid() yet), so it can't reuse
-- log_audit_event, which looks up the caller's own profile.
create or replace function public.log_failed_login(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (event, actor_name, actor_role, status)
  values ('Failed Login Attempt', coalesce(nullif(trim(p_email), ''), 'Unknown'), 'Unknown', 'warning');
end;
$$;

grant execute on function public.log_failed_login(text) to anon, authenticated;
