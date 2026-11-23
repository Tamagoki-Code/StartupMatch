-- Functional Requirement "Project Requirement Posting" asks for per-milestone
-- schedule info, but only an aggregate phase count was ever persisted —
-- the titles/due dates typed into the Post-a-Project form were discarded.
alter table marketplace_projects
  add column if not exists milestones jsonb not null default '[]'::jsonb;
