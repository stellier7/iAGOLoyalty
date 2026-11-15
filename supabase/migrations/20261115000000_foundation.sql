-- Phase 1 foundation: tenants, staff roles, invitations, subscriptions, and audit.
-- Loyalty ledger, stamp QR, and NFC stamp carriers are Phase 2. Both carriers
-- will post through the same server-side stamp operation. NFC tags store the
-- same HTTPS URL as the stamp QR so iPhone and Android can open it without an app.

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email citext unique,
  avatar_url text,
  platform_role text check (platform_role in ('super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text,
  status text not null default 'active' check (status in ('active', 'suspended', 'pending')),
  logo_url text,
  brand_color text,
  brand_color_secondary text,
  timezone text not null default 'America/Tegucigalpa',
  default_currency char(3) not null default 'HNL',
  locale text not null default 'es',
  contact_email citext,
  contact_phone text,
  address jsonb,
  enrollment_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 48),
  constraint businesses_currency_format check (default_currency ~ '^[A-Z]{3}$'),
  constraint businesses_locale_format check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'employee')),
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'invited', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email citext not null,
  role text not null check (role in ('owner', 'admin', 'employee')),
  permissions jsonb not null default '{}'::jsonb,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create unique index business_invitations_one_pending_email
  on public.business_invitations (business_id, email)
  where accepted_at is null;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  plan_code text not null default 'pilot',
  status text not null default 'manual' check (status in ('trialing', 'active', 'past_due', 'canceled', 'manual')),
  provider text,
  external_customer_id text,
  external_subscription_id text,
  current_period_end timestamptz,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create index business_members_user_id_idx on public.business_members (user_id);
create index business_members_business_id_idx on public.business_members (business_id);
create index business_invitations_business_id_idx on public.business_invitations (business_id);
create index audit_logs_business_created_idx on public.audit_logs (business_id, created_at desc);
create index businesses_status_idx on public.businesses (status);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger businesses_touch_updated_at
  before update on public.businesses
  for each row execute function public.touch_updated_at();

create trigger business_members_touch_updated_at
  before update on public.business_members
  for each row execute function public.touch_updated_at();

create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.email, '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and platform_role = 'super_admin'
  );
$$;

create or replace function public.shares_business(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = target_business
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_business_manager(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_business is not null and exists (
    select 1
    from public.business_members
    where business_id = target_business
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.has_business_permission(target_business uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or public.is_business_manager(target_business)
    or exists (
      select 1
      from public.business_members
      where business_id = target_business
        and user_id = auth.uid()
        and status = 'active'
        and role = 'employee'
        and coalesce(permissions -> permission, 'false'::jsonb) = 'true'::jsonb
    );
$$;

create or replace function public.can_read_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_profile = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1
      from public.business_members mine
      join public.business_members theirs on theirs.business_id = mine.business_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = target_profile
    );
$$;

create or replace function public.clean_permissions(input jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(entry.key, entry.value),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(input, '{}'::jsonb)) as entry
  where entry.key in (
    'scan',
    'issue_stamps',
    'issue_points',
    'redeem',
    'view_customers',
    'manage_campaigns',
    'manage_settings',
    'manage_team'
  )
    and jsonb_typeof(entry.value) = 'boolean';
$$;

create or replace function public.assert_timezone(target_timezone text)
returns void
language plpgsql
as $$
begin
  if target_timezone is null or btrim(target_timezone) = '' then
    raise exception 'iago:invalid_timezone';
  end if;
  begin
    perform now() at time zone target_timezone;
  exception
    when invalid_parameter_value then
      raise exception 'iago:invalid_timezone';
  end;
end;
$$;

create or replace function public.create_invitation(
  p_business_id uuid,
  p_email text,
  p_role text,
  p_permissions jsonb
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token text;
  business_status text;
begin
  if not public.has_business_permission(p_business_id, 'manage_team') then
    raise exception 'iago:not_authorized';
  end if;

  select status into business_status from public.businesses where id = p_business_id;
  if business_status is null then
    raise exception 'iago:not_found';
  end if;
  if business_status <> 'active' and not public.is_platform_admin() then
    raise exception 'iago:business_suspended';
  end if;
  if p_role not in ('owner', 'admin', 'employee') then
    raise exception 'iago:invalid_role';
  end if;
  if p_email is null or btrim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'iago:invalid_email';
  end if;

  token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');

  insert into public.business_invitations (
    business_id,
    email,
    role,
    permissions,
    token_hash,
    expires_at,
    invited_by
  ) values (
    p_business_id,
    btrim(p_email)::citext,
    p_role,
    case when p_role = 'employee' then public.clean_permissions(p_permissions) else '{}'::jsonb end,
    encode(digest(token, 'sha256'), 'hex'),
    now() + interval '7 days',
    auth.uid()
  );

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_business_id,
    auth.uid(),
    'invitation.created',
    'invitation',
    null,
    jsonb_build_object('email', btrim(p_email), 'role', p_role)
  );

  return token;
end;
$$;

create or replace function public.create_business(
  p_name text,
  p_slug text,
  p_timezone text,
  p_currency text,
  p_locale text,
  p_contact_email text,
  p_owner_email text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  token text;
  clean_slug text;
  clean_currency text;
begin
  if not public.is_platform_admin() then
    raise exception 'iago:not_authorized';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 80 then
    raise exception 'iago:invalid_name';
  end if;

  clean_slug := btrim(p_slug);
  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(clean_slug) > 48 then
    raise exception 'iago:invalid_slug';
  end if;

  clean_currency := upper(btrim(p_currency));
  if clean_currency !~ '^[A-Z]{3}$' then
    raise exception 'iago:invalid_currency';
  end if;
  if p_locale is null or p_locale !~ '^[a-z]{2}(-[A-Z]{2})?$' then
    raise exception 'iago:invalid_locale';
  end if;
  perform public.assert_timezone(p_timezone);
  if p_contact_email is not null
    and btrim(p_contact_email) <> ''
    and btrim(p_contact_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'iago:invalid_email';
  end if;

  insert into public.businesses (name, slug, status, timezone, default_currency, locale, contact_email)
  values (
    btrim(p_name),
    clean_slug,
    'active',
    p_timezone,
    clean_currency,
    p_locale,
    nullif(btrim(coalesce(p_contact_email, '')), '')
  )
  returning id into new_id;

  insert into public.subscriptions (business_id, plan_code, status)
  values (new_id, 'pilot', 'manual');

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new_id,
    auth.uid(),
    'business.created',
    'business',
    new_id,
    jsonb_build_object('name', btrim(p_name), 'slug', clean_slug)
  );

  if p_owner_email is not null and btrim(p_owner_email) <> '' then
    token := public.create_invitation(new_id, btrim(p_owner_email), 'owner', '{}'::jsonb);
  end if;

  return jsonb_build_object('business_id', new_id, 'invitation_token', token);
exception
  when unique_violation then
    if sqlerrm ilike '%businesses_slug%' then
      raise exception 'iago:slug_taken';
    end if;
    raise;
end;
$$;

create or replace function public.set_business_status(p_business_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'iago:not_authorized';
  end if;
  if p_status not in ('active', 'suspended', 'pending') then
    raise exception 'iago:invalid_status';
  end if;
  update public.businesses set status = p_status where id = p_business_id;
  if not found then
    raise exception 'iago:not_found';
  end if;
  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_business_id, auth.uid(), 'business.status_changed', 'business', p_business_id, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.update_business_profile(
  p_business_id uuid,
  p_name text,
  p_timezone text,
  p_currency text,
  p_locale text,
  p_contact_email text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  business_status text;
  clean_currency text;
begin
  if not public.has_business_permission(p_business_id, 'manage_settings') then
    raise exception 'iago:not_authorized';
  end if;
  select status into business_status from public.businesses where id = p_business_id;
  if business_status is null then
    raise exception 'iago:not_found';
  end if;
  if business_status <> 'active' and not public.is_platform_admin() then
    raise exception 'iago:business_suspended';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 80 then
    raise exception 'iago:invalid_name';
  end if;
  clean_currency := upper(btrim(p_currency));
  if clean_currency !~ '^[A-Z]{3}$' then
    raise exception 'iago:invalid_currency';
  end if;
  if p_locale is null or p_locale !~ '^[a-z]{2}(-[A-Z]{2})?$' then
    raise exception 'iago:invalid_locale';
  end if;
  perform public.assert_timezone(p_timezone);
  if p_contact_email is not null
    and btrim(p_contact_email) <> ''
    and btrim(p_contact_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'iago:invalid_email';
  end if;

  update public.businesses
  set name = btrim(p_name),
      timezone = p_timezone,
      default_currency = clean_currency,
      locale = p_locale,
      contact_email = nullif(btrim(coalesce(p_contact_email, '')), '')
  where id = p_business_id;

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_business_id, auth.uid(), 'business.profile_updated', 'business', p_business_id, '{}'::jsonb);
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  invitation public.business_invitations%rowtype;
  actor_email text;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  if p_token is null or char_length(p_token) < 20 then
    raise exception 'iago:invitation_invalid';
  end if;

  select * into invitation
  from public.business_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'iago:invitation_invalid';
  end if;
  if invitation.accepted_at is not null then
    raise exception 'iago:invitation_used';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'iago:invitation_expired';
  end if;

  select email into actor_email from auth.users where id = auth.uid();
  if actor_email is null or actor_email::citext <> invitation.email then
    raise exception 'iago:invitation_email_mismatch';
  end if;

  insert into public.business_members (business_id, user_id, role, permissions, status)
  values (
    invitation.business_id,
    auth.uid(),
    invitation.role,
    case when invitation.role = 'employee' then invitation.permissions else '{}'::jsonb end,
    'active'
  )
  on conflict (business_id, user_id) do update
    set role = excluded.role,
        permissions = excluded.permissions,
        status = 'active',
        updated_at = now();

  update public.business_invitations
  set accepted_at = now()
  where id = invitation.id;

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    invitation.business_id,
    auth.uid(),
    'invitation.accepted',
    'membership',
    auth.uid(),
    jsonb_build_object('role', invitation.role)
  );

  return invitation.business_id;
end;
$$;

create or replace function public.preview_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  invitation public.business_invitations%rowtype;
  business_name text;
begin
  if p_token is null or char_length(p_token) < 20 then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into invitation
  from public.business_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;
  if invitation.accepted_at is not null then
    return jsonb_build_object('state', 'used');
  end if;
  if invitation.expires_at <= now() then
    return jsonb_build_object('state', 'expired');
  end if;

  select name into business_name from public.businesses where id = invitation.business_id;
  return jsonb_build_object(
    'state', 'pending',
    'business_name', business_name,
    'email', invitation.email,
    'role', invitation.role,
    'expires_at', invitation.expires_at
  );
end;
$$;

create or replace function public.revoke_member(p_business_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  owner_count integer;
begin
  if not public.has_business_permission(p_business_id, 'manage_team') then
    raise exception 'iago:not_authorized';
  end if;

  select role into target_role
  from public.business_members
  where business_id = p_business_id and user_id = p_user_id and status = 'active';

  if target_role is null then
    raise exception 'iago:not_found';
  end if;

  if target_role = 'owner' then
    select count(*) into owner_count
    from public.business_members
    where business_id = p_business_id and role = 'owner' and status = 'active';
    if owner_count <= 1 then
      raise exception 'iago:last_owner';
    end if;
  end if;

  update public.business_members
  set status = 'revoked'
  where business_id = p_business_id and user_id = p_user_id;

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_business_id, auth.uid(), 'member.revoked', 'membership', p_user_id, '{}'::jsonb);
end;
$$;

create or replace function public.set_member_permissions(
  p_business_id uuid,
  p_user_id uuid,
  p_permissions jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if not public.has_business_permission(p_business_id, 'manage_team') then
    raise exception 'iago:not_authorized';
  end if;

  select role into target_role
  from public.business_members
  where business_id = p_business_id and user_id = p_user_id and status = 'active';

  if target_role is null then
    raise exception 'iago:not_found';
  end if;
  if target_role <> 'employee' then
    raise exception 'iago:not_employee';
  end if;

  update public.business_members
  set permissions = public.clean_permissions(p_permissions)
  where business_id = p_business_id and user_id = p_user_id;

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_business_id, auth.uid(), 'member.permissions_updated', 'membership', p_user_id, public.clean_permissions(p_permissions));
end;
$$;

create or replace function public.list_invitations(p_business_id uuid)
returns table (
  id uuid,
  email text,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_business_permission(p_business_id, 'manage_team') then
    raise exception 'iago:not_authorized';
  end if;

  return query
  select
    invitation.id,
    invitation.email::text,
    invitation.role,
    invitation.expires_at,
    invitation.accepted_at,
    invitation.created_at
  from public.business_invitations invitation
  where invitation.business_id = p_business_id
  order by invitation.created_at desc;
end;
$$;

create or replace function public.update_own_profile(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  if p_full_name is null or char_length(btrim(p_full_name)) < 2 or char_length(btrim(p_full_name)) > 80 then
    raise exception 'iago:invalid_name';
  end if;
  update public.profiles set full_name = btrim(p_full_name) where id = auth.uid();
end;
$$;

create or replace function public.set_platform_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'iago:not_authorized';
  end if;
  if p_key not in ('support_email', 'product_name') then
    raise exception 'iago:invalid_setting';
  end if;
  if p_value is null or char_length(btrim(p_value)) = 0 or char_length(p_value) > 160 then
    raise exception 'iago:invalid_setting';
  end if;
  insert into public.platform_settings (key, value, updated_by)
  values (p_key, to_jsonb(btrim(p_value)), auth.uid())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now(),
        updated_by = excluded.updated_by;
  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'platform_setting.updated', 'platform_setting', null, jsonb_build_object('key', p_key));
end;
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_invitations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

alter table public.profiles force row level security;
alter table public.businesses force row level security;
alter table public.business_members force row level security;
alter table public.business_invitations force row level security;
alter table public.subscriptions force row level security;
alter table public.audit_logs force row level security;
alter table public.platform_settings force row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_read_profile(id));

create policy businesses_select on public.businesses
  for select to authenticated
  using (public.is_platform_admin() or public.shares_business(id));

create policy business_members_select on public.business_members
  for select to authenticated
  using (public.is_platform_admin() or public.shares_business(business_id));

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.is_platform_admin() or public.shares_business(business_id));

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_platform_admin() or public.is_business_manager(business_id));

create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using (public.is_platform_admin());

revoke all on all tables in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.businesses, public.business_members, public.subscriptions, public.audit_logs, public.platform_settings to authenticated;

revoke all on all functions in schema public from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.shares_business(uuid) to authenticated;
grant execute on function public.is_business_manager(uuid) to authenticated;
grant execute on function public.has_business_permission(uuid, text) to authenticated;
grant execute on function public.can_read_profile(uuid) to authenticated;
grant execute on function public.clean_permissions(jsonb) to authenticated;
grant execute on function public.create_business(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, text, jsonb) to authenticated;
grant execute on function public.set_business_status(uuid, text) to authenticated;
grant execute on function public.update_business_profile(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.list_invitations(uuid) to authenticated;
grant execute on function public.preview_invitation(text) to anon, authenticated;
grant execute on function public.revoke_member(uuid, uuid) to authenticated;
grant execute on function public.set_member_permissions(uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_own_profile(text) to authenticated;
grant execute on function public.set_platform_setting(text, text) to authenticated;
