-- send_deadline_reminders() is meant to run only via pg_cron, which calls it
-- in-database directly, not through the Data API. Postgres functions are
-- exposed over PostgREST by default, so any authenticated user could
-- currently trigger it via supabase.rpc('send_deadline_reminders'). It's
-- idempotent (no duplicate notifications), but there's no reason to leave
-- an unused public RPC entry point.
revoke execute on function public.send_deadline_reminders() from public;
revoke execute on function public.send_deadline_reminders() from anon;
revoke execute on function public.send_deadline_reminders() from authenticated;
