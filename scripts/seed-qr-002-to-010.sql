-- Create permanent QR codes 002-010 so they appear in Admin → QR destinations.
-- Temporary destination: iAGO home. Edit each later to the Google review URL.
-- Safe to re-run: existing codes are skipped.
-- Do not use this for 001 if it already points at Google.

insert into public.qr_redirects (code, business_name, destination_type, destination_url, status)
select v.code, v.business_name, v.destination_type, v.destination_url, v.status
from (
  values
    ('002', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('003', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('004', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('005', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('006', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('007', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('008', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('009', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active'),
    ('010', 'Perfumes y Belleza', 'google_reviews', 'https://loyalty.iagodigital.com/', 'active')
) as v(code, business_name, destination_type, destination_url, status)
where not exists (
  select 1 from public.qr_redirects existing where existing.code = v.code
);

select code, business_name, destination_url, status
from public.qr_redirects
where code ~ '^[0-9]{3}$'
order by code;
