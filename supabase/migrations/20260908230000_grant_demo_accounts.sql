-- Disposable demo accounts for showing the app to friends/clients.
-- Enterprise: verified, no role change needed. Moderator: promoted from
-- student to admin + verified, same pattern as the earlier test-account grant.

update public.profiles
set verification_status = 'Verified'
where email = 'sm.demo.enterprise@gmail.com';

update public.profiles
set role = 'admin', verification_status = 'Verified'
where email = 'sm.demo.moderator@gmail.com';
