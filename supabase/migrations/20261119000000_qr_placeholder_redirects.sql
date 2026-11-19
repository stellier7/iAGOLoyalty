-- Allow permanent QR codes to be printed before a destination URL exists.
-- Scanners still resolve the code; the app sends them to the iAGO home page
-- until a Google / WhatsApp / website URL is saved.

alter table public.qr_redirects
  alter column destination_url drop not null;

alter table public.qr_redirects
  drop constraint if exists qr_redirects_url_http;

alter table public.qr_redirects
  add constraint qr_redirects_url_http
  check (
    destination_url is null
    or destination_url ~* '^https?://'
  );

create or replace function public.assert_qr_redirect_url(p_url text)
returns text
language plpgsql
immutable
as $$
begin
  if p_url is null or btrim(p_url) = '' then
    return null;
  end if;
  if btrim(p_url) !~* '^https?://[^[:space:]]+$' then
    raise exception 'iago:invalid_destination_url';
  end if;
  if lower(btrim(p_url)) ~* '^(javascript|data|vbscript|file):' then
    raise exception 'iago:invalid_destination_url';
  end if;
  return btrim(p_url);
end;
$$;

create or replace function public.resolve_qr_redirect(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.qr_redirects%rowtype;
begin
  if p_code is null or btrim(p_code) !~ '^[0-9A-Za-z]{1,32}$' then
    return null;
  end if;

  select * into v_row
  from public.qr_redirects
  where code = btrim(p_code)
    and status = 'active';

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'code', v_row.code,
    'destination_url', v_row.destination_url,
    'destination_type', v_row.destination_type,
    'placeholder', v_row.destination_url is null
  );
end;
$$;

create or replace function public.create_qr_redirect(
  p_business_name text,
  p_destination_type text,
  p_destination_url text,
  p_status text default 'active',
  p_code text default null,
  p_business_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_url text;
  v_name text;
  v_status text;
  v_row public.qr_redirects%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'iago:not_authorized';
  end if;

  v_name := btrim(coalesce(p_business_name, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'iago:invalid_name';
  end if;

  if p_destination_type not in ('google_reviews', 'whatsapp', 'instagram', 'website', 'custom') then
    raise exception 'iago:invalid_destination_type';
  end if;

  v_status := coalesce(nullif(btrim(p_status), ''), 'active');
  if v_status not in ('active', 'inactive') then
    raise exception 'iago:invalid_status';
  end if;

  v_url := public.assert_qr_redirect_url(p_destination_url);

  if p_business_id is not null and not exists (
    select 1 from public.businesses where id = p_business_id
  ) then
    raise exception 'iago:not_found';
  end if;

  if p_code is null or btrim(p_code) = '' then
    v_code := public.next_qr_redirect_code();
  else
    v_code := btrim(p_code);
    if v_code !~ '^[0-9A-Za-z]{1,32}$' then
      raise exception 'iago:invalid_qr_code';
    end if;
  end if;

  begin
    insert into public.qr_redirects (
      code,
      business_name,
      business_id,
      destination_type,
      destination_url,
      status
    ) values (
      v_code,
      v_name,
      p_business_id,
      p_destination_type,
      v_url,
      v_status
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'iago:qr_code_taken';
  end;

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_business_id,
    auth.uid(),
    'qr_redirect.created',
    'qr_redirect',
    v_row.id,
    jsonb_build_object(
      'code', v_row.code,
      'destination_type', v_row.destination_type,
      'status', v_row.status,
      'placeholder', v_row.destination_url is null
    )
  );

  return jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'business_name', v_row.business_name,
    'business_id', v_row.business_id,
    'destination_type', v_row.destination_type,
    'destination_url', v_row.destination_url,
    'status', v_row.status
  );
end;
$$;

create or replace function public.update_qr_redirect(
  p_id uuid,
  p_business_name text,
  p_destination_type text,
  p_destination_url text,
  p_status text,
  p_business_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_name text;
  v_status text;
  v_row public.qr_redirects%rowtype;
  v_old_code text;
begin
  if not public.is_platform_admin() then
    raise exception 'iago:not_authorized';
  end if;

  select code into v_old_code from public.qr_redirects where id = p_id;
  if v_old_code is null then
    raise exception 'iago:not_found';
  end if;

  v_name := btrim(coalesce(p_business_name, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'iago:invalid_name';
  end if;

  if p_destination_type not in ('google_reviews', 'whatsapp', 'instagram', 'website', 'custom') then
    raise exception 'iago:invalid_destination_type';
  end if;

  v_status := btrim(coalesce(p_status, ''));
  if v_status not in ('active', 'inactive') then
    raise exception 'iago:invalid_status';
  end if;

  v_url := public.assert_qr_redirect_url(p_destination_url);

  if p_business_id is not null and not exists (
    select 1 from public.businesses where id = p_business_id
  ) then
    raise exception 'iago:not_found';
  end if;

  update public.qr_redirects
  set
    business_name = v_name,
    business_id = p_business_id,
    destination_type = p_destination_type,
    destination_url = v_url,
    status = v_status
  where id = p_id
  returning * into v_row;

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_business_id,
    auth.uid(),
    'qr_redirect.updated',
    'qr_redirect',
    v_row.id,
    jsonb_build_object(
      'code', v_row.code,
      'destination_type', v_row.destination_type,
      'status', v_row.status,
      'code_unchanged', v_row.code = v_old_code,
      'placeholder', v_row.destination_url is null
    )
  );

  return jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'business_name', v_row.business_name,
    'business_id', v_row.business_id,
    'destination_type', v_row.destination_type,
    'destination_url', v_row.destination_url,
    'status', v_row.status
  );
end;
$$;

create or replace function public.create_qr_redirect_batch(
  p_count integer,
  p_business_name text,
  p_destination_type text,
  p_status text default 'active',
  p_business_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codes text[] := '{}';
  v_created jsonb;
  i integer;
begin
  if not public.is_platform_admin() then
    raise exception 'iago:not_authorized';
  end if;
  if p_count is null or p_count < 1 or p_count > 50 then
    raise exception 'iago:invalid_batch_count';
  end if;

  for i in 1..p_count loop
    v_created := public.create_qr_redirect(
      p_business_name,
      p_destination_type,
      null,
      p_status,
      null,
      p_business_id
    );
    v_codes := array_append(v_codes, v_created ->> 'code');
  end loop;

  return jsonb_build_object('codes', to_jsonb(v_codes), 'count', p_count);
end;
$$;

grant execute on function public.create_qr_redirect_batch(integer, text, text, text, uuid) to authenticated;
