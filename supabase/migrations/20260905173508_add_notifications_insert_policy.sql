-- The initial schema only granted select/update on notifications (recipient
-- only), with no insert policy at all — so every notify() call from
-- contracts.ts (award/submit/approve/dispute/comment) was silently rejected
-- by RLS. Notifications are always created BY one contract participant FOR
-- the other, so the inserter is never the recipient; allow any signed-in
-- user to insert one (mirrors the existing peer_reviews insert policy).

create policy "notifications insertable by any signed-in user" on notifications
  for insert to authenticated with check (true);
