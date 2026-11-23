-- Thesis dataflow spec: "If a project phase goes beyond the allowed
-- milestone deadline grace period, then the tracking record is flagged for
-- dispute." We already send an overdue reminder (see
-- 20260908140000_automated_deadline_reminders.sql); this adds the actual
-- status transition after a grace period, instead of leaving it to a manual
-- dispute from the enterprise.

create or replace function public.auto_dispute_overdue_phases()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  grace_days constant int := 3; -- days past deadline before auto-dispute
begin
  update contract_phases cp
  set status = 'disputed',
      revision_reason = coalesce(revision_reason, 'Auto-flagged: submission deadline passed with no activity.')
  from contracts c
  where c.id = cp.contract_id
    and cp.status in ('active', 'in_review')
    and cp.dev_deadline is not null
    and cp.dev_deadline < current_date - grace_days;

  insert into notifications (recipient_id, type, body)
  select c.student_id, 'warning',
    format('Sprint %s was automatically flagged for dispute — the deadline passed %s days ago with no resolution.', cp.number, (current_date - cp.dev_deadline))
  from contract_phases cp
  join contracts c on c.id = cp.contract_id
  where cp.status = 'disputed'
    and cp.dev_deadline is not null
    and cp.dev_deadline < current_date - grace_days
    and cp.overdue_reminder_sent_at is not null
    -- only the run that just flagged it (avoid renotifying every day after)
    and cp.revision_reason = 'Auto-flagged: submission deadline passed with no activity.'
    and not exists (
      select 1 from notifications n
      where n.recipient_id = c.student_id
        and n.body like format('Sprint %s was automatically flagged%%', cp.number)
    );
end;
$$;

revoke execute on function public.auto_dispute_overdue_phases() from public, anon, authenticated;

select cron.unschedule('auto-dispute-overdue-phases')
where exists (select 1 from cron.job where jobname = 'auto-dispute-overdue-phases');

select cron.schedule(
  'auto-dispute-overdue-phases',
  '30 0 * * *', -- daily, 30 min after the reminder job
  $$select public.auto_dispute_overdue_phases();$$
);
