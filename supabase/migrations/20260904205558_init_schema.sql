-- Startup-Match initial schema
-- Mirrors the mock data shapes in src/devProfile.ts, src/clientProfile.ts and
-- src/projectStore.ts so the frontend can be migrated off in-memory mocks
-- incrementally. One profile row per auth.users row; role-specific detail
-- lives in student_profiles / enterprise_profiles.

-- ─── Enums ─────────────────────────────────────────────────────────────────

create type user_role as enum ('student', 'enterprise', 'admin');
create type verification_status as enum ('Verified', 'Pending Review', 'Under Review', 'Rejected');
create type project_status as enum ('Completed', 'Disputed', 'Active');
create type bid_status as enum ('Pending', 'Awarded', 'Declined');
create type marketplace_status as enum ('Open', 'Awarded', 'Closed');
create type phase_status as enum ('completed', 'active', 'in_review', 'disputed', 'revision', 'upcoming');
create type notif_type as enum ('warning', 'success', 'info');
create type comment_role as enum ('developer', 'client', 'admin');
create type link_icon as enum ('github', 'linkedin', 'globe');

-- ─── Core profile (1:1 with auth.users) ─────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'student',
  name text not null,
  email text not null unique,
  initials text,
  avatar_color_bg text,
  avatar_color_fg text,
  verification_status verification_status not null default 'Pending Review',
  created_at timestamptz not null default now()
);

-- ─── Student (developer) profile ────────────────────────────────────────────

create table student_profiles (
  profile_id uuid primary key references profiles (id) on delete cascade,
  title text,
  school text,
  chapter text,
  availability boolean not null default true,
  skills text[] not null default '{}',
  tools text[] not null default '{}',
  response_rate text
);

create table student_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (profile_id) on delete cascade,
  icon link_icon not null,
  label text not null,
  href text not null
);

-- Portfolio / fulfillment history shown on the public developer profile.
create table student_projects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (profile_id) on delete cascade,
  name text not null,
  client text not null,
  project_date date,
  status project_status not null default 'Active',
  budget text,
  summary text,
  tech text[] not null default '{}'
);

create table peer_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (profile_id) on delete cascade,
  reviewer_name text not null,
  reviewer_role text,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  project_id uuid references student_projects (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Uploaded CVs/resumes for the matching algorithm. `parsed_skills` /
-- `match_score` are written by the algorithm after processing the file in
-- the `resumes` storage bucket at `file_path`.
create table resumes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (profile_id) on delete cascade,
  file_path text not null,
  parsed_skills jsonb,
  match_score numeric,
  uploaded_at timestamptz not null default now()
);

-- ─── Enterprise (client) profile ────────────────────────────────────────────

create table enterprise_profiles (
  profile_id uuid primary key references profiles (id) on delete cascade,
  business text not null,
  barangay text,
  permit text
);

-- ─── Marketplace ─────────────────────────────────────────────────────────────

create table marketplace_projects (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references enterprise_profiles (profile_id) on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  budget_min integer,
  budget_max integer,
  deadline date,
  phases integer not null default 1,
  status marketplace_status not null default 'Open',
  posted_at timestamptz not null default now()
);

create table bids (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references marketplace_projects (id) on delete cascade,
  student_id uuid not null references student_profiles (profile_id) on delete cascade,
  amount integer not null,
  status bid_status not null default 'Pending',
  placed_at timestamptz not null default now(),
  unique (project_id, student_id)
);

-- ─── Awarded contract + sprint/milestone tracking ───────────────────────────
-- One contract per awarded bid. Each phase carries a separate "dev" view
-- (Sprint Dashboard, student-facing) and "client" view (Milestone Tracking,
-- enterprise-facing) to match the two-sided phase content in the current UI
-- (see ProjectPhase in src/projectStore.ts).

create table contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references marketplace_projects (id) on delete cascade,
  student_id uuid not null references student_profiles (profile_id),
  bid_id uuid references bids (id),
  contract_type text not null default 'Fixed Price',
  total_budget integer not null,
  phase_budget integer not null,
  phase_payout integer not null,
  paid_to_date integer not null default 0,
  total_phases integer not null,
  started date not null default current_date,
  deadline date,
  platform text default 'StartupMatch'
);

create table contract_phases (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  number integer not null,
  status phase_status not null default 'upcoming',
  submitted_at timestamptz,
  approved_at timestamptz,
  score smallint check (score between 1 and 5),
  revision_reason text,
  dev_title text,
  dev_deadline date,
  dev_description text,
  dev_repo_link text,
  dev_prototype_link text,
  dev_updates text,
  client_title text,
  client_deadline date,
  client_description text,
  client_repo_link text,
  client_prototype_link text,
  client_updates text,
  unique (contract_id, number)
);

create table phase_tasks (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references contract_phases (id) on delete cascade,
  label text not null,
  done boolean not null default false
);

create table phase_comments (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references contract_phases (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  author_name text not null,
  role comment_role not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  type notif_type not null default 'info',
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index on student_links (student_id);
create index on student_projects (student_id);
create index on peer_reviews (student_id);
create index on resumes (student_id);
create index on marketplace_projects (enterprise_id);
create index on marketplace_projects (status);
create index on bids (project_id);
create index on bids (student_id);
create index on contracts (project_id);
create index on contracts (student_id);
create index on contract_phases (contract_id);
create index on phase_tasks (phase_id);
create index on phase_comments (phase_id);
create index on notifications (recipient_id);

-- ─── Helper: role of the calling user ───────────────────────────────────────

create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Profiles, portfolios and marketplace listings are readable by any signed-in
-- user (this is a public marketplace); writes are restricted to the owning
-- account or an admin. Contract/phase detail is restricted to the two
-- participants (the assigned student, the posting enterprise) plus admins.

alter table profiles enable row level security;
alter table student_profiles enable row level security;
alter table student_links enable row level security;
alter table student_projects enable row level security;
alter table peer_reviews enable row level security;
alter table resumes enable row level security;
alter table enterprise_profiles enable row level security;
alter table marketplace_projects enable row level security;
alter table bids enable row level security;
alter table contracts enable row level security;
alter table contract_phases enable row level security;
alter table phase_tasks enable row level security;
alter table phase_comments enable row level security;
alter table notifications enable row level security;

-- profiles
create policy "profiles readable by signed-in users" on profiles
  for select to authenticated using (true);
create policy "profiles editable by owner or admin" on profiles
  for update to authenticated using (id = auth.uid() or is_admin());
create policy "profiles insertable by owner" on profiles
  for insert to authenticated with check (id = auth.uid());

-- student_profiles
create policy "student profiles readable by signed-in users" on student_profiles
  for select to authenticated using (true);
create policy "student profiles editable by owner or admin" on student_profiles
  for all to authenticated
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- student_links / student_projects / peer_reviews / resumes
create policy "student links readable by signed-in users" on student_links
  for select to authenticated using (true);
create policy "student links editable by owner or admin" on student_links
  for all to authenticated
  using (student_id = auth.uid() or is_admin())
  with check (student_id = auth.uid() or is_admin());

create policy "student projects readable by signed-in users" on student_projects
  for select to authenticated using (true);
create policy "student projects editable by owner or admin" on student_projects
  for all to authenticated
  using (student_id = auth.uid() or is_admin())
  with check (student_id = auth.uid() or is_admin());

create policy "peer reviews readable by signed-in users" on peer_reviews
  for select to authenticated using (true);
create policy "peer reviews insertable by signed-in users" on peer_reviews
  for insert to authenticated with check (true);
create policy "peer reviews editable by admin" on peer_reviews
  for update to authenticated using (is_admin());
create policy "peer reviews deletable by admin" on peer_reviews
  for delete to authenticated using (is_admin());

create policy "resumes readable by owner or admin" on resumes
  for select to authenticated using (student_id = auth.uid() or is_admin());
create policy "resumes editable by owner or admin" on resumes
  for all to authenticated
  using (student_id = auth.uid() or is_admin())
  with check (student_id = auth.uid() or is_admin());

-- enterprise_profiles
create policy "enterprise profiles readable by signed-in users" on enterprise_profiles
  for select to authenticated using (true);
create policy "enterprise profiles editable by owner or admin" on enterprise_profiles
  for all to authenticated
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- marketplace_projects
create policy "marketplace projects readable by signed-in users" on marketplace_projects
  for select to authenticated using (true);
create policy "marketplace projects editable by owning enterprise or admin" on marketplace_projects
  for all to authenticated
  using (enterprise_id = auth.uid() or is_admin())
  with check (enterprise_id = auth.uid() or is_admin());

-- bids: student sees/creates their own; enterprise sees bids on their
-- projects and can update status (award/decline); admin sees all.
create policy "bids readable by participant or admin" on bids
  for select to authenticated using (
    student_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from marketplace_projects mp
      where mp.id = bids.project_id and mp.enterprise_id = auth.uid()
    )
  );
create policy "bids insertable by bidding student" on bids
  for insert to authenticated with check (student_id = auth.uid());
create policy "bids updatable by project owner, bidder or admin" on bids
  for update to authenticated using (
    student_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from marketplace_projects mp
      where mp.id = bids.project_id and mp.enterprise_id = auth.uid()
    )
  );

-- contracts / contract_phases / phase_tasks / phase_comments: visible to the
-- assigned student, the posting enterprise, or an admin.
create policy "contracts readable by participant or admin" on contracts
  for select to authenticated using (
    student_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from marketplace_projects mp
      where mp.id = contracts.project_id and mp.enterprise_id = auth.uid()
    )
  );
create policy "contracts writable by participant or admin" on contracts
  for all to authenticated
  using (
    student_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from marketplace_projects mp
      where mp.id = contracts.project_id and mp.enterprise_id = auth.uid()
    )
  )
  with check (
    student_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from marketplace_projects mp
      where mp.id = contracts.project_id and mp.enterprise_id = auth.uid()
    )
  );

create policy "contract phases readable by participant or admin" on contract_phases
  for select to authenticated using (
    is_admin()
    or exists (
      select 1 from contracts c
      join marketplace_projects mp on mp.id = c.project_id
      where c.id = contract_phases.contract_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  );
create policy "contract phases writable by participant or admin" on contract_phases
  for all to authenticated
  using (
    is_admin()
    or exists (
      select 1 from contracts c
      join marketplace_projects mp on mp.id = c.project_id
      where c.id = contract_phases.contract_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from contracts c
      join marketplace_projects mp on mp.id = c.project_id
      where c.id = contract_phases.contract_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  );

create policy "phase tasks follow phase access" on phase_tasks
  for all to authenticated
  using (
    is_admin()
    or exists (
      select 1 from contract_phases cp
      join contracts c on c.id = cp.contract_id
      join marketplace_projects mp on mp.id = c.project_id
      where cp.id = phase_tasks.phase_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from contract_phases cp
      join contracts c on c.id = cp.contract_id
      join marketplace_projects mp on mp.id = c.project_id
      where cp.id = phase_tasks.phase_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  );

create policy "phase comments follow phase access" on phase_comments
  for all to authenticated
  using (
    is_admin()
    or exists (
      select 1 from contract_phases cp
      join contracts c on c.id = cp.contract_id
      join marketplace_projects mp on mp.id = c.project_id
      where cp.id = phase_comments.phase_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from contract_phases cp
      join contracts c on c.id = cp.contract_id
      join marketplace_projects mp on mp.id = c.project_id
      where cp.id = phase_comments.phase_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  );

-- notifications: recipient only.
create policy "notifications readable by recipient" on notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy "notifications updatable by recipient" on notifications
  for update to authenticated using (recipient_id = auth.uid());

-- ─── Storage: resumes bucket ─────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "resume files readable by owner or admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'resumes'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
create policy "resume files writable by owner" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "resume files updatable by owner" on storage.objects
  for update to authenticated using (
    bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "resume files deletable by owner or admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'resumes'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
