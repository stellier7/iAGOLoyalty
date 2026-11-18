-- Permanent QR redirect codes. The short code never changes when the
-- destination URL, business name, or destination type is updated.
-- Public scanners hit /go/{code} and receive a temporary HTTP redirect.

create table public.qr_redirects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  business_name text not null,
  business_id uuid references public.businesses (id) on delete set null,
  destination_type text not null
    check (destination_type in ('google_reviews', 'whatsapp', 'instagram', 'website', 'custom')),
  destination_url text not null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_redirects_code_format check (code ~ '^[0-9A-Za-z]{1,32}$'),
  constraint qr_redirects_name_length check (char_length(btrim(business_name)) between 2 and 120),
  constraint qr_redirects_url_http check (destination_url ~* '^https?://')
);

create index qr_redirects_status_idx on public.qr_redirects (status);
create index qr_redirects_business_id_idx on public.qr_redirects (business_id);

create trigger qr_redirects_touch_updated_at
  before update on public.qr_redirects
  for each row execute function public.touch_updated_at();

create or replace function public.assert_qr_redirect_url(p_url text)
returns text
language plpgsql
immutable
as $$
begin
  if p_url is null or btrim(p_url) = '' then
    raise exception 'iago:invalid_destination_url';
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

create or replace function public.next_qr_redirect_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
begin
  if not public.is_platform_admin() then
    raise exception 'iago:not_authorized';
  end if;

  select coalesce(max(code::integer), 0)
    into v_max
  from public.qr_redirects
  where code ~ '^[0-9]+$';

  return lpad((v_max + 1)::text, greatest(3, length((v_max + 1)::text)), '0');
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
    'destination_type', v_row.destination_type
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
      'status', v_row.status
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
      'code_unchanged', v_row.code = v_old_code
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

alter table public.qr_redirects enable row level security;

create policy qr_redirects_select on public.qr_redirects
  for select to authenticated
  using (public.is_platform_admin());

grant select on public.qr_redirects to authenticated;
grant execute on function public.assert_qr_redirect_url(text) to authenticated;
grant execute on function public.next_qr_redirect_code() to authenticated;
grant execute on function public.resolve_qr_redirect(text) to anon, authenticated;
grant execute on function public.create_qr_redirect(text, text, text, text, text, uuid) to authenticated;
grant execute on function public.update_qr_redirect(uuid, text, text, text, text, uuid) to authenticated;
