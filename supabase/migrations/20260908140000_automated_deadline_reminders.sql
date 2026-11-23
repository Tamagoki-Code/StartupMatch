-- Automated Reminders (thesis Functional Requirement): real-time reminders
-- for upcoming milestone deadlines or overdue developer submissions.
-- Implemented Supabase-native (pg_cron + a SECURITY DEFINER function that
-- writes to the existing `notifications` table) instead of Firebase Cloud
-- Messaging, per project scope — this is in-app, not device push.

alter table contract_phases
  add column if not exists deadline_reminder_sent_at timestamptz,
  add column if not exists overdue_reminder_sent_at timestamptz;

create or replace function public.send_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Upcoming: active/in_review phase whose dev deadline is within 2 days.
  insert into notifications (recipient_id, type, body)
  select c.student_id, 'warning',
    format('Sprint %s deadline is approaching (%s). Submit your work before it''s due.', cp.number, to_char(cp.dev_deadline, 'Mon DD, YYYY'))
  from contract_phases cp
  join contracts c on c.id = cp.contract_id
  where cp.status in ('active', 'in_review')
    and cp.dev_deadline is not null
    and cp.dev_deadline between current_date and current_date + 2
    and cp.deadline_reminder_sent_at is null;

  update contract_phases cp
  set deadline_reminder_sent_at = now()
  from contracts c
  where c.id = cp.contract_id
    and cp.status in ('active', 'in_review')
    and cp.dev_deadline is not null
    and cp.dev_deadline between current_date and current_date + 2
    and cp.deadline_reminder_sent_at is null;

  -- Overdue: active/in_review phase whose dev deadline has already passed.
  insert into notifications (recipient_id, type, body)
  select c.student_id, 'warning',
    format('Sprint %s submission is overdue (deadline was %s). Please submit or contact the client.', cp.number, to_char(cp.dev_deadline, 'Mon DD, YYYY'))
  from contract_phases cp
  join contracts c on c.id = cp.contract_id
  where cp.status in ('active', 'in_review')
    and cp.dev_deadline is not null
    and cp.dev_deadline < current_date
    and cp.overdue_reminder_sent_at is null;

  update contract_phases cp
  set overdue_reminder_sent_at = now()
  from contracts c
  where c.id = cp.contract_id
    and cp.status in ('active', 'in_review')
    and cp.dev_deadline is not null
    and cp.dev_deadline < current_date
    and cp.overdue_reminder_sent_at is null;
end;
$$;

create extension if not exists pg_cron with schema extensions;

select cron.unschedule('deadline-reminders')
where exists (select 1 from cron.job where jobname = 'deadline-reminders');

select cron.schedule(
  'deadline-reminders',
  '0 0 * * *', -- once a day, midnight UTC
  $$select public.send_deadline_reminders();$$
);
