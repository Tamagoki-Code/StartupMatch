-- Help / support tickets: students and businesses contact PSITS moderators
-- through a ticket (subject + thread) instead of direct messages, and
-- moderators work them from a queue. Also adds an optional profile picture
-- (business logo) shown on marketplace listings.

-- Only images uploaded through the app's Cloudinary account are accepted, so
-- a profile can't point every viewer's browser at an arbitrary URL.
alter table profiles add column if not exists avatar_url text
  check (avatar_url ~ '^https://res\.cloudinary\.com/[a-z0-9_-]+/image/upload/');

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles (id) on delete cascade,
  subject text not null check (length(trim(subject)) between 1 and 150),
  category text not null default 'General'
    check (category in ('General', 'Account & Verification', 'Projects & Bids', 'Milestones & Payments', 'Report a Problem')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index on support_tickets (created_by);
create index on support_tickets (status, updated_at desc);
create index on support_ticket_messages (ticket_id, created_at);

alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;

create policy "tickets readable by creator or admin" on support_tickets
  for select to authenticated using (created_by = auth.uid() or is_admin());

-- A new ticket always starts open; only moderators change its status.
create policy "tickets creatable by owner" on support_tickets
  for insert to authenticated with check (created_by = auth.uid() and status = 'open');

create policy "tickets status updatable by admin" on support_tickets
  for update to authenticated using (is_admin()) with check (is_admin());

create policy "ticket messages readable by creator or admin" on support_ticket_messages
  for select to authenticated using (
    is_admin()
    or exists (select 1 from support_tickets t where t.id = ticket_id and t.created_by = auth.uid())
  );

create policy "ticket messages writable by creator or admin" on support_ticket_messages
  for insert to authenticated with check (
    author_id = auth.uid()
    and (
      is_admin()
      or exists (select 1 from support_tickets t where t.id = ticket_id and t.created_by = auth.uid())
    )
  );

-- Server-side so it can't be skipped or spoofed: every message bumps the
-- ticket, a user's message notifies all moderators, and a moderator's reply
-- notifies the ticket owner.
create or replace function public.on_support_ticket_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t support_tickets%rowtype;
begin
  select * into t from support_tickets where id = new.ticket_id;
  update support_tickets set updated_at = new.created_at where id = new.ticket_id;

  if new.author_id = t.created_by then
    insert into notifications (recipient_id, type, body)
    select p.id, 'info', format('Support ticket: "%s" has a new message.', t.subject)
    from profiles p
    where p.role = 'admin' and p.id <> new.author_id;
  else
    insert into notifications (recipient_id, type, body)
    values (t.created_by, 'info', format('A PSITS moderator replied to your support ticket "%s".', t.subject));
  end if;

  return new;
end;
$$;

create trigger trg_on_support_ticket_message
  after insert on support_ticket_messages
  for each row execute function on_support_ticket_message();
