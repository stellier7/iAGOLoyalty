-- Seed QR2–QR10 as Website defaults to https://iagodigital.com
-- QR1 (001) is left alone if it already has a Google Reviews destination.

update public.qr_redirects
set
  business_name = 'QR1',
  updated_at = now()
where code = '001'
  and business_name is distinct from 'QR1';

insert into public.qr_redirects (code, business_name, destination_type, destination_url, status)
select v.code, v.business_name, v.destination_type, v.destination_url, v.status
from (
  values
    ('002', 'QR2', 'website', 'https://iagodigital.com/', 'active'),
    ('003', 'QR3', 'website', 'https://iagodigital.com/', 'active'),
    ('004', 'QR4', 'website', 'https://iagodigital.com/', 'active'),
    ('005', 'QR5', 'website', 'https://iagodigital.com/', 'active'),
    ('006', 'QR6', 'website', 'https://iagodigital.com/', 'active'),
    ('007', 'QR7', 'website', 'https://iagodigital.com/', 'active'),
    ('008', 'QR8', 'website', 'https://iagodigital.com/', 'active'),
    ('009', 'QR9', 'website', 'https://iagodigital.com/', 'active'),
    ('010', 'QR10', 'website', 'https://iagodigital.com/', 'active')
) as v(code, business_name, destination_type, destination_url, status)
where not exists (
  select 1 from public.qr_redirects existing where existing.code = v.code
);

-- Fix any already-seeded QR2–QR10 that still point at the loyalty app as "Google Reviews"
update public.qr_redirects
set
  destination_type = 'website',
  destination_url = 'https://iagodigital.com/',
  updated_at = now()
where code in ('002', '003', '004', '005', '006', '007', '008', '009', '010');

select code, business_name, destination_type, destination_url, status
from public.qr_redirects
where code in ('001', '002', '003', '004', '005', '006', '007', '008', '009', '010')
order by code;
