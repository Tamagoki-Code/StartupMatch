-- The "Post a Project" form (ProjectSpecForm) collects a barangay per
-- listing (a business can post from different zones), but the schema only
-- had barangay on enterprise_profiles — that value was being silently
-- discarded on publish. Store it per-project instead.

alter table marketplace_projects add column barangay text;

-- Backfill existing rows from the posting enterprise's profile, best-effort.
update marketplace_projects mp
set barangay = ep.barangay
from enterprise_profiles ep
where ep.profile_id = mp.enterprise_id and mp.barangay is null;
