-- One-off: mark the dev test account as Verified so it gets full student
-- access without needing an admin account to approve it through the UI yet.
update public.profiles
set verification_status = 'Verified'
where email = 'testconncheck@gmail.com';
