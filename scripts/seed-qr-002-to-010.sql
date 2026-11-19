-- Rename 001 to QR1 (keeps its Google destination).
-- Create 002-010 as QR2-QR10 for Admin → QR destinations.
-- Temporary destination: iAGO home. Edit each later to the Google review URL.
-- Safe to re-run: existing codes are skipped.

update public.qr_redirects
set business_name = 'QR1'
where code = '001';

insert into public.qr_redirects (code, business_name, destination_type, destination_url, status)
select v.code, v.business_name, v.destination_type, v.destination_url, v.status
from (
  values
    ('002', 'QR2', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('003', 'QR3', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('004', 'QR4', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('005', 'QR5', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('006', 'QR6', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('007', 'QR7', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('008', 'QR8', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('009', 'QR9', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('010', 'QR10', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active')
) as v(code, business_name, destination_type, destination_url, status)
where not exists (
  select 1 from public.qr_redirects existing where existing.code = v.code
);

select code, business_name, destination_url, status
from public.qr_redirects
where code ~ '^[0-9]{3}$'
order by code;
