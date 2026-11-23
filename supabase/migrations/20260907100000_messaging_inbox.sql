-- ─── Real inbox / direct messages ────────────────────────────────────────────
-- A proper messaging system, independent of any contract or sprint phase —
-- previously "Messages" was just the phase-comment feature repurposed, tied
-- to whichever contract phase happened to be active and hardcoded to author
-- role "client" regardless of who was actually typing.
--
-- Standard 3-table shape: a conversation has participants, and messages
-- belong to a conversation. Kept general enough to support group threads
-- later even though the UI only ever creates 1:1 conversations today.

create table conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table conversation_participants (
  conversation_id uuid not null references conversations (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index on conversation_participants (profile_id);
create index on messages (conversation_id, created_at);
create index on conversations (last_message_at desc);

-- ─── Helper: am I in this conversation? ──────────────────────────────────────
-- SECURITY DEFINER so the RLS policies below can check membership without
-- recursively re-triggering RLS on conversation_participants itself.

create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv_id and profile_id = auth.uid()
  )
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- No direct insert policies on conversations/conversation_participants —
-- creating a conversation only happens through get_or_create_conversation()
-- below (SECURITY DEFINER), so two people can't be added to a thread by a
-- third party crafting an insert.

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;

create policy "conversations readable by participant" on conversations
  for select to authenticated using (is_conversation_participant(id));

create policy "participants readable by conversation members" on conversation_participants
  for select to authenticated using (is_conversation_participant(conversation_id));

create policy "participants can update their own read marker" on conversation_participants
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "messages readable by conversation participant" on messages
  for select to authenticated using (is_conversation_participant(conversation_id));

create policy "messages sendable by conversation participant" on messages
  for insert to authenticated
  with check (sender_id = auth.uid() and is_conversation_participant(conversation_id));

-- ─── Trigger: bump conversations.last_message_at on every new message ───────

create or replace function public.bump_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_bump_conversation_last_message
  after insert on messages
  for each row
  execute function bump_conversation_last_message();

-- ─── RPC: find or start a 1:1 conversation with another user ────────────────

create or replace function public.get_or_create_conversation(other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if me = other_profile_id then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  select c.conversation_id into conv_id
  from (
    select conversation_id,
           count(*) as participant_count,
           bool_or(profile_id = me) as has_me,
           bool_or(profile_id = other_profile_id) as has_other
    from conversation_participants
    group by conversation_id
  ) c
  where c.participant_count = 2 and c.has_me and c.has_other
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  insert into conversations default values returning id into conv_id;
  insert into conversation_participants (conversation_id, profile_id)
    values (conv_id, me), (conv_id, other_profile_id);

  return conv_id;
end;
$$;
