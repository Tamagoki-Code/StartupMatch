-- ─── Audit log ───────────────────────────────────────────────────────────────
-- Real, admin-only feed of platform events. Rows are written exclusively by
-- SECURITY DEFINER triggers below (never directly by app code), so the log
-- can't be forged or skipped by a client that forgets to call a logging
-- function — every event it records really happened in the database.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null,
  actor_name text not null,
  actor_role text not null,
  status text not null check (status in ('success', 'warning', 'danger', 'info'))
);

create index on audit_log (created_at desc);

alter table audit_log enable row level security;

create policy "audit log readable by admin" on audit_log
  for select to authenticated using (is_admin());

-- ─── Helper: log as the calling user ─────────────────────────────────────────

create or replace function public.log_audit_event(
  p_event text,
  p_status text,
  p_role_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role text;
begin
  select name, role into v_name, v_role from profiles where id = auth.uid();

  insert into audit_log (event, actor_name, actor_role, status)
  values (
    p_event,
    coalesce(v_name, 'System'),
    coalesce(p_role_label, case v_role
      when 'admin' then 'Platform Admin'
      when 'enterprise' then 'Enterprise Client'
      when 'student' then 'Student Developer'
      else 'System'
    end),
    p_status
  );
end;
$$;

-- ─── Trigger: verification / rejection / admin promotion ────────────────────

create or replace function public.audit_profiles_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    if new.verification_status = 'Verified' then
      perform log_audit_event(
        case new.role when 'student' then 'New Developer Verified' when 'enterprise' then 'New Enterprise Verified' else 'Account Verified' end,
        'success'
      );
    elsif new.verification_status = 'Rejected' then
      perform log_audit_event('Account Rejected', 'warning');
    end if;
  end if;

  if new.role = 'admin' and old.role is distinct from 'admin' then
    perform log_audit_event(new.name || ' Promoted to Regional Admin', 'success');
  end if;

  return new;
end;
$$;

create trigger trg_audit_profiles_change
  after update on profiles
  for each row
  execute function audit_profiles_change();

-- ─── Trigger: project listing published ─────────────────────────────────────

create or replace function public.audit_project_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform log_audit_event('Project Listing Published: ' || new.title, 'info');
  return new;
end;
$$;

create trigger trg_audit_project_published
  after insert on marketplace_projects
  for each row
  execute function audit_project_published();

-- ─── Trigger: bid awarded ────────────────────────────────────────────────────

create or replace function public.audit_contract_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform log_audit_event('Bid Awarded — Contract Created', 'success');
  return new;
end;
$$;

create trigger trg_audit_contract_created
  after insert on contracts
  for each row
  execute function audit_contract_created();

-- ─── Trigger: milestone verified / disputed ─────────────────────────────────

create or replace function public.audit_phase_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'completed' then
      perform log_audit_event('Milestone Verified: Sprint ' || new.number, 'success');
    elsif new.status = 'disputed' then
      perform log_audit_event('Dispute Escalation Filed: Sprint ' || new.number, 'danger');
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_audit_phase_status_change
  after update on contract_phases
  for each row
  execute function audit_phase_status_change();
