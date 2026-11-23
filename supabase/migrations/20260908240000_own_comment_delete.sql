-- The original "phase comments follow phase access" policy was `for all`,
-- so any party on a contract (student or enterprise) could delete ANY
-- comment on that phase, including the other party's. Splitting it so
-- delete requires authorship (or admin) is what actually lets users delete
-- only their own comments, as the feature request asks.

drop policy "phase comments follow phase access" on phase_comments;

create policy "phase comments select by participant or admin" on phase_comments
  for select to authenticated using (
    is_admin()
    or exists (
      select 1 from contract_phases cp
      join contracts c on c.id = cp.contract_id
      join marketplace_projects mp on mp.id = c.project_id
      where cp.id = phase_comments.phase_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  );

create policy "phase comments insert by participant or admin" on phase_comments
  for insert to authenticated with check (
    is_admin()
    or exists (
      select 1 from contract_phases cp
      join contracts c on c.id = cp.contract_id
      join marketplace_projects mp on mp.id = c.project_id
      where cp.id = phase_comments.phase_id
        and (c.student_id = auth.uid() or mp.enterprise_id = auth.uid())
    )
  );

create policy "phase comments delete own or admin" on phase_comments
  for delete to authenticated using (
    is_admin() or author_id = auth.uid()
  );
