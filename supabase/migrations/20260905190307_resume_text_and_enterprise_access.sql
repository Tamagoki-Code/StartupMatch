-- Enables enterprise-side applicant ranking (the "Business Owner Portal"
-- half of the original PortfolioMatch AI prototype): ranking bidders on a
-- listing by resume fit.

-- Re-ranking a resume against a NEW, arbitrary job listing requires the
-- original extracted text (the cached per-role scores in parsed_skills
-- aren't enough — the listing's semantic embedding changes per posting).
alter table resumes add column resume_text text;

-- The existing resumes policy only let the student themselves (or an
-- admin) read a resume. An enterprise needs to read the resume of anyone
-- who has bid on one of ITS OWN listings — scoped narrowly to that
-- relationship, not a blanket "any enterprise sees any resume".
create policy "resumes readable by enterprise via bid" on resumes
  for select to authenticated using (
    exists (
      select 1 from bids b
      join marketplace_projects mp on mp.id = b.project_id
      where b.student_id = resumes.student_id and mp.enterprise_id = auth.uid()
    )
  );
