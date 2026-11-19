-- Align stored destinations with what `/go/{code}` actually opens.
-- Bad seed rows used google_reviews + loyalty.iagodigital.com, which failed
-- type checks and fell back to https://iagodigital.com while the admin form
-- still showed the loyalty URL.

update public.qr_redirects
set
  destination_type = 'website',
  destination_url = 'https://iagodigital.com/',
  updated_at = now()
where
  coalesce(destination_url, '') ilike '%loyalty.iagodigital.com%'
  or (
    destination_type = 'google_reviews'
    and destination_url is not null
    and btrim(destination_url) <> ''
    and destination_url !~* '(google\.com|google\.com\.hn|goo\.gl|g\.page|maps\.app\.goo\.gl)'
  );
