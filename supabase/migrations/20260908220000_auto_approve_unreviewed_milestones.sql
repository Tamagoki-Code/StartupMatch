-- Mirrors the student-side protection in 20260908140000/190000 (reminder +
-- auto-dispute for a late Student submission) with the Enterprise-side one
-- promised in the Terms: a Student should never lose time/payout waiting on
-- an unresponsive client. A milestone left "in_review" past the review
-- window is auto-approved (payout released) rather than left stuck.

alter table contract_phases
  add column if not exists review_reminder_sent_at timestamptz;

create or replace function public.send_review_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reminder to the enterprise: a submitted milestone is approaching its
  -- 5-day review window with no action yet.
  insert into notifications (recipient_id, type, body)
  select mp.enterprise_id, 'warning',
    format('Sprint %s from %s is awaiting your review (submitted %s). Please review within 5 business days.',
      cp.number, p.name, to_char(cp.submitted_at, 'Mon DD, YYYY'))
  from contract_phases cp
  join contracts c on c.id = cp.contract_id
  join marketplace_projects mp on mp.id = c.project_id
  join profiles p on p.id = c.student_id
  where cp.status = 'in_review'
    and cp.submitted_at is not null
    and cp.submitted_at <= now() - interval '3 days'
    and cp.review_reminder_sent_at is null;

  update contract_phases cp
  set review_reminder_sent_at = now()
  from contracts c
  where c.id = cp.contract_id
    and cp.status = 'in_review'
    and cp.submitted_at is not null
    and cp.submitted_at <= now() - interval '3 days'
    and cp.review_reminder_sent_at is null;
end;
$$;

create or replace function public.auto_approve_unreviewed_milestones()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  review_window constant interval := '5 days';
  r record;
begin
  for r in
    select cp.id as phase_id, cp.number, c.id as contract_id, c.student_id, c.phase_payout
    from contract_phases cp
    join contracts c on c.id = cp.contract_id
    where cp.status = 'in_review'
      and cp.submitted_at is not null
      and cp.submitted_at <= now() - review_window
  loop
    update contract_phases
    set status = 'completed', approved_at = now(), score = coalesce(score, 5)
    where id = r.phase_id;

    update contracts
    set paid_to_date = paid_to_date + r.phase_payout
    where id = r.contract_id;

    insert into notifications (recipient_id, type, body)
    values (
      r.student_id, 'success',
      format('Sprint %s was automatically approved — the client did not review it within 5 business days. Payment has been credited.', r.number)
    );
  end loop;
end;
$$;

revoke execute on function public.send_review_reminders() from public, anon, authenticated;
revoke execute on function public.auto_approve_unreviewed_milestones() from public, anon, authenticated;

select cron.unschedule('send-review-reminders')
where exists (select 1 from cron.job where jobname = 'send-review-reminders');
select cron.schedule('send-review-reminders', '15 0 * * *', $$select public.send_review_reminders();$$);

select cron.unschedule('auto-approve-unreviewed-milestones')
where exists (select 1 from cron.job where jobname = 'auto-approve-unreviewed-milestones');
select cron.schedule('auto-approve-unreviewed-milestones', '45 0 * * *', $$select public.auto_approve_unreviewed_milestones();$$);
