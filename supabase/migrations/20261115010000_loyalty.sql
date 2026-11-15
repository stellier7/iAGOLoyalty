-- Phase 2 loyalty engine. Stamps, points, and redemptions are posted only
-- through post_loyalty. A stamp QR and an NFC tag are the same HTTPS code:
-- the page passes customer_qr or customer_nfc into collect_stamp.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email citext not null,
  phone text,
  birthday date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, email)
);

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  program_type text not null check (program_type in ('stamps', 'points')),
  status text not null default 'active' check (status in ('active', 'archived')),
  is_primary boolean not null default false,
  stamps_required integer,
  stamp_cooldown_seconds integer not null default 300,
  allow_manual_stamps boolean not null default true,
  stamp_reward_id uuid,
  points_per_currency_unit numeric(12, 4),
  min_purchase_amount numeric(14, 2) not null default 0,
  max_points_per_transaction integer,
  currency_code char(3) not null,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_programs_name_length check (char_length(name) between 2 and 80),
  constraint loyalty_programs_currency check (currency_code ~ '^[A-Z]{3}$'),
  constraint loyalty_programs_cooldown check (stamp_cooldown_seconds between 0 and 86400),
  constraint loyalty_programs_min_purchase check (min_purchase_amount >= 0),
  constraint loyalty_programs_stamps_shape check (
    program_type <> 'stamps'
    or (
      stamps_required between 1 and 100
      and points_per_currency_unit is null
    )
  ),
  constraint loyalty_programs_points_shape check (
    program_type <> 'points'
    or (
      points_per_currency_unit > 0
      and stamps_required is null
    )
  )
);

create unique index loyalty_programs_one_primary
  on public.loyalty_programs (business_id)
  where is_primary and status = 'active';

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  program_id uuid not null references public.loyalty_programs (id) on delete cascade,
  name text not null,
  description text,
  reward_type text not null check (
    reward_type in ('free_product', 'percentage_discount', 'fixed_discount', 'exclusive_offer', 'promotion')
  ),
  points_cost integer,
  stamps_cost integer,
  discount_percent numeric(5, 2),
  discount_amount numeric(14, 2),
  inventory_limit integer,
  redeemed_count integer not null default 0,
  per_customer_limit integer,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rewards_name_length check (char_length(name) between 2 and 80),
  constraint rewards_points_cost check (points_cost is null or points_cost > 0),
  constraint rewards_stamps_cost check (stamps_cost is null or stamps_cost > 0),
  constraint rewards_inventory check (inventory_limit is null or inventory_limit >= 0),
  constraint rewards_redeemed_count check (redeemed_count >= 0),
  constraint rewards_per_customer check (per_customer_limit is null or per_customer_limit > 0)
);

alter table public.loyalty_programs
  add constraint loyalty_programs_stamp_reward_fk
  foreign key (stamp_reward_id) references public.rewards (id) on delete set null;

create table public.loyalty_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  program_id uuid not null references public.loyalty_programs (id) on delete restrict,
  public_token text not null unique,
  membership_number text not null,
  points_balance integer not null default 0,
  stamps_balance integer not null default 0,
  lifetime_points integer not null default 0,
  lifetime_stamps integer not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, membership_number),
  unique (customer_id, program_id),
  constraint loyalty_memberships_points_nonnegative check (points_balance >= 0 and lifetime_points >= 0),
  constraint loyalty_memberships_stamps_nonnegative check (stamps_balance >= 0 and lifetime_stamps >= 0)
);

create table public.reward_entitlements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  membership_id uuid not null references public.loyalty_memberships (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  status text not null default 'available' check (status in ('available', 'redeemed', 'expired', 'revoked')),
  source_transaction_id uuid,
  redeemed_transaction_id uuid,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  membership_id uuid not null references public.loyalty_memberships (id) on delete restrict,
  type text not null check (
    type in ('stamp_added', 'points_earned', 'reward_granted', 'reward_redeemed')
  ),
  points_delta integer not null default 0,
  stamps_delta integer not null default 0,
  amount numeric(14, 2),
  currency_code char(3),
  reward_id uuid references public.rewards (id) on delete set null,
  entitlement_id uuid references public.reward_entitlements (id) on delete set null,
  source text not null check (
    source in ('scan', 'manual', 'customer_qr', 'customer_nfc', 'api', 'webhook', 'system')
  ),
  idempotency_key text not null,
  external_reference text,
  reason text,
  actor_user_id uuid references public.profiles (id) on delete set null,
  points_balance_after integer not null,
  stamps_balance_after integer not null,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

alter table public.reward_entitlements
  add constraint reward_entitlements_source_tx_fk
  foreign key (source_transaction_id) references public.loyalty_transactions (id) on delete set null;

alter table public.reward_entitlements
  add constraint reward_entitlements_redeemed_tx_fk
  foreign key (redeemed_transaction_id) references public.loyalty_transactions (id) on delete set null;

create unique index loyalty_transactions_external_ref
  on public.loyalty_transactions (business_id, external_reference)
  where external_reference is not null;

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  kind text not null check (kind in ('program', 'email', 'whatsapp', 'sms')),
  granted boolean not null,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.stamp_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  program_id uuid not null references public.loyalty_programs (id) on delete cascade,
  label text,
  kind text not null check (kind in ('static', 'rotating')),
  code text not null unique,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.stamp_collections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  membership_id uuid not null references public.loyalty_memberships (id) on delete cascade,
  stamp_code_id uuid not null references public.stamp_codes (id) on delete cascade,
  collected_at timestamptz not null default now()
);

create table public.rate_limits (
  bucket text primary key,
  hits integer not null,
  window_start timestamptz not null
);

create index customers_business_idx on public.customers (business_id);
create index loyalty_programs_business_idx on public.loyalty_programs (business_id);
create index loyalty_memberships_business_idx on public.loyalty_memberships (business_id);
create index loyalty_memberships_token_idx on public.loyalty_memberships (public_token);
create index loyalty_transactions_membership_idx
  on public.loyalty_transactions (membership_id, created_at desc);
create index loyalty_transactions_business_idx
  on public.loyalty_transactions (business_id, created_at desc);
create index stamp_collections_cooldown_idx
  on public.stamp_collections (membership_id, stamp_code_id, collected_at desc);
create index reward_entitlements_membership_idx
  on public.reward_entitlements (membership_id, status);

create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();

create trigger loyalty_programs_touch_updated_at
  before update on public.loyalty_programs
  for each row execute function public.touch_updated_at();

create trigger rewards_touch_updated_at
  before update on public.rewards
  for each row execute function public.touch_updated_at();

create trigger loyalty_memberships_touch_updated_at
  before update on public.loyalty_memberships
  for each row execute function public.touch_updated_at();

create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

create or replace function public.guard_membership_balances()
returns trigger
language plpgsql
as $$
begin
  if new.points_balance is distinct from old.points_balance
    or new.stamps_balance is distinct from old.stamps_balance
    or new.lifetime_points is distinct from old.lifetime_points
    or new.lifetime_stamps is distinct from old.lifetime_stamps then
    if current_setting('iago.ledger', true) is distinct from 'on' then
      raise exception 'iago:balance_locked';
    end if;
  end if;
  return new;
end;
$$;

create trigger loyalty_memberships_guard_balances
  before update on public.loyalty_memberships
  for each row execute function public.guard_membership_balances();

create or replace function public.guard_loyalty_ledger()
returns trigger
language plpgsql
as $$
begin
  raise exception 'iago:ledger_immutable';
end;
$$;

create trigger loyalty_transactions_immutable
  before update or delete on public.loyalty_transactions
  for each row execute function public.guard_loyalty_ledger();

create or replace function public.random_token(p_bytes integer)
returns text
language sql
volatile
as $$
  select replace(replace(replace(encode(gen_random_bytes(p_bytes), 'base64'), '+', '-'), '/', '_'), '=', '');
$$;

create or replace function public.assert_idempotency_key(p_key text)
returns void
language plpgsql
as $$
begin
  if p_key is null or char_length(btrim(p_key)) < 8 or char_length(p_key) > 80 then
    raise exception 'iago:invalid_idempotency';
  end if;
end;
$$;

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text;
  v_hits integer;
begin
  if p_bucket is null or btrim(p_bucket) = '' then
    return;
  end if;
  v_bucket := left(btrim(p_bucket), 160);
  insert into public.rate_limits as existing (bucket, hits, window_start)
  values (v_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case
          when existing.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else existing.hits + 1
        end,
        window_start = case
          when existing.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else existing.window_start
        end
  returning hits into v_hits;
  if v_hits > p_limit then
    raise exception 'iago:rate_limited';
  end if;
end;
$$;

create or replace function public.assert_business_open(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.businesses where id = p_business_id;
  if v_status is null then
    raise exception 'iago:not_found';
  end if;
  if v_status <> 'active' then
    raise exception 'iago:business_suspended';
  end if;
end;
$$;

create or replace function public.loyalty_result(p_transaction_id uuid, p_idempotent boolean)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'transaction_id', tx.id,
    'points_balance', coalesce(cycle.points_balance_after, tx.points_balance_after),
    'stamps_balance', coalesce(cycle.stamps_balance_after, tx.stamps_balance_after),
    'idempotent', p_idempotent,
    'entitlement_granted', cycle.id is not null
  )
  from public.loyalty_transactions tx
  left join public.loyalty_transactions cycle
    on cycle.business_id = tx.business_id
   and cycle.idempotency_key = tx.idempotency_key || ':cycle'
  where tx.id = p_transaction_id;
$$;

create or replace function public.post_loyalty(
  p_membership_id uuid,
  p_type text,
  p_points_delta integer,
  p_stamps_delta integer,
  p_amount numeric,
  p_currency text,
  p_reward_id uuid,
  p_entitlement_id uuid,
  p_source text,
  p_idempotency_key text,
  p_external_reference text,
  p_reason text,
  p_actor uuid,
  p_require_confirm boolean,
  p_confirm boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.loyalty_memberships%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_existing public.loyalty_transactions%rowtype;
  v_external text;
  v_points integer;
  v_stamps integer;
  v_tx_id uuid;
  v_cycle_id uuid;
  v_remainder integer;
  v_cycles integer;
  v_granted boolean := false;
  v_step integer;
begin
  perform public.assert_idempotency_key(p_idempotency_key);
  if p_type not in ('stamp_added', 'points_earned', 'reward_granted', 'reward_redeemed') then
    raise exception 'iago:invalid_transaction';
  end if;
  if p_source not in ('scan', 'manual', 'customer_qr', 'customer_nfc', 'api', 'webhook', 'system') then
    raise exception 'iago:invalid_source';
  end if;

  select * into v_membership
  from public.loyalty_memberships
  where id = p_membership_id
  for update;
  if not found then
    raise exception 'iago:not_found';
  end if;

  v_external := nullif(btrim(coalesce(p_external_reference, '')), '');

  select * into v_existing
  from public.loyalty_transactions
  where business_id = v_membership.business_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.membership_id <> v_membership.id then
      raise exception 'iago:invalid_idempotency';
    end if;
    return public.loyalty_result(v_existing.id, true);
  end if;

  if v_external is not null then
    select * into v_existing
    from public.loyalty_transactions
    where business_id = v_membership.business_id
      and external_reference = v_external;
    if found then
      if v_existing.membership_id <> v_membership.id then
        raise exception 'iago:duplicate_reference';
      end if;
      return public.loyalty_result(v_existing.id, true);
    end if;
  end if;

  if coalesce(p_require_confirm, false)
    and not coalesce(p_confirm, false)
    and p_type in ('stamp_added', 'points_earned')
    and exists (
      select 1
      from public.loyalty_transactions recent
      where recent.membership_id = v_membership.id
        and recent.type = p_type
        and recent.source = p_source
        and recent.actor_user_id is not distinct from p_actor
        and recent.created_at > now() - interval '15 seconds'
    ) then
    raise exception 'iago:duplicate_scan';
  end if;

  v_points := v_membership.points_balance + coalesce(p_points_delta, 0);
  v_stamps := v_membership.stamps_balance + coalesce(p_stamps_delta, 0);
  if v_points < 0 or v_stamps < 0 or v_points > 100000000 or v_stamps > 100000 then
    raise exception 'iago:insufficient_balance';
  end if;

  perform set_config('iago.ledger', 'on', true);
  update public.loyalty_memberships
  set points_balance = v_points,
      stamps_balance = v_stamps,
      lifetime_points = lifetime_points + greatest(coalesce(p_points_delta, 0), 0),
      lifetime_stamps = lifetime_stamps + greatest(coalesce(p_stamps_delta, 0), 0)
  where id = v_membership.id;

  insert into public.loyalty_transactions (
    business_id,
    membership_id,
    type,
    points_delta,
    stamps_delta,
    amount,
    currency_code,
    reward_id,
    entitlement_id,
    source,
    idempotency_key,
    external_reference,
    reason,
    actor_user_id,
    points_balance_after,
    stamps_balance_after
  ) values (
    v_membership.business_id,
    v_membership.id,
    p_type,
    coalesce(p_points_delta, 0),
    coalesce(p_stamps_delta, 0),
    p_amount,
    p_currency,
    p_reward_id,
    p_entitlement_id,
    p_source,
    p_idempotency_key,
    v_external,
    p_reason,
    p_actor,
    v_points,
    v_stamps
  )
  returning id into v_tx_id;

  if p_type = 'stamp_added' then
    select * into v_program from public.loyalty_programs where id = v_membership.program_id;
    if v_program.program_type = 'stamps'
      and v_program.stamps_required is not null
      and v_stamps >= v_program.stamps_required then
      v_cycles := v_stamps / v_program.stamps_required;
      v_remainder := v_stamps % v_program.stamps_required;
      update public.loyalty_memberships
      set stamps_balance = v_remainder
      where id = v_membership.id;
      insert into public.loyalty_transactions (
        business_id,
        membership_id,
        type,
        points_delta,
        stamps_delta,
        reward_id,
        source,
        idempotency_key,
        reason,
        actor_user_id,
        points_balance_after,
        stamps_balance_after
      ) values (
        v_membership.business_id,
        v_membership.id,
        'reward_granted',
        0,
        v_remainder - v_stamps,
        v_program.stamp_reward_id,
        'system',
        p_idempotency_key || ':cycle',
        'Stamp card completed',
        p_actor,
        v_points,
        v_remainder
      )
      returning id into v_cycle_id;
      if v_program.stamp_reward_id is not null then
        for v_step in 1..v_cycles loop
          insert into public.reward_entitlements (
            business_id, membership_id, reward_id, status, source_transaction_id
          ) values (
            v_membership.business_id,
            v_membership.id,
            v_program.stamp_reward_id,
            'available',
            v_cycle_id
          );
        end loop;
        v_granted := true;
      end if;
      v_stamps := v_remainder;
    end if;
  end if;

  return jsonb_build_object(
    'transaction_id', v_tx_id,
    'points_balance', v_points,
    'stamps_balance', v_stamps,
    'idempotent', false,
    'entitlement_granted', v_granted
  );
end;
$$;

create or replace function public.enroll_customer(
  p_slug text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_birthday date,
  p_accept boolean,
  p_email_consent boolean,
  p_whatsapp_consent boolean,
  p_sms_consent boolean,
  p_rate_bucket text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_customer_id uuid;
  v_token text;
  v_number text;
  v_attempt integer;
  v_phone text;
begin
  perform public.consume_rate_limit(p_rate_bucket, 40, 3600);
  if coalesce(p_accept, false) is not true then
    raise exception 'iago:program_not_accepted';
  end if;
  if p_first_name is null or char_length(btrim(p_first_name)) < 1 or char_length(btrim(p_first_name)) > 80
    or p_last_name is null or char_length(btrim(p_last_name)) < 1 or char_length(btrim(p_last_name)) > 80 then
    raise exception 'iago:invalid_name';
  end if;
  if p_email is null or btrim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'iago:invalid_email';
  end if;
  v_phone := nullif(btrim(coalesce(p_phone, '')), '');
  if v_phone is not null and v_phone !~ '^\+?[0-9][0-9 \-]{6,18}$' then
    raise exception 'iago:invalid_phone';
  end if;
  if p_birthday is not null and (p_birthday > current_date or p_birthday < current_date - interval '120 years') then
    raise exception 'iago:invalid_birthday';
  end if;

  select * into v_business from public.businesses where slug = btrim(p_slug);
  if not found then
    raise exception 'iago:not_found';
  end if;
  perform public.assert_business_open(v_business.id);
  if not v_business.enrollment_enabled then
    raise exception 'iago:enrollment_closed';
  end if;

  select * into v_program
  from public.loyalty_programs
  where business_id = v_business.id
    and is_primary
    and status = 'active';
  if not found then
    raise exception 'iago:program_unavailable';
  end if;

  if exists (
    select 1 from public.customers
    where business_id = v_business.id
      and email = btrim(p_email)::citext
  ) then
    raise exception 'iago:already_enrolled';
  end if;

  insert into public.customers (business_id, first_name, last_name, email, phone, birthday)
  values (
    v_business.id,
    btrim(p_first_name),
    btrim(p_last_name),
    btrim(p_email)::citext,
    v_phone,
    p_birthday
  )
  returning id into v_customer_id;

  insert into public.consent_records (business_id, customer_id, kind, granted)
  values
    (v_business.id, v_customer_id, 'program', true),
    (v_business.id, v_customer_id, 'email', coalesce(p_email_consent, false)),
    (v_business.id, v_customer_id, 'whatsapp', coalesce(p_whatsapp_consent, false)),
    (v_business.id, v_customer_id, 'sms', coalesce(p_sms_consent, false));

  insert into public.notification_preferences (
    customer_id, business_id, email_enabled, whatsapp_enabled, sms_enabled
  ) values (
    v_customer_id,
    v_business.id,
    coalesce(p_email_consent, false),
    coalesce(p_whatsapp_consent, false),
    coalesce(p_sms_consent, false)
  );

  for v_attempt in 1..5 loop
    v_token := public.random_token(24);
    v_number := upper(left(regexp_replace(v_business.slug, '[^a-z0-9]', '', 'g'), 4))
      || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
    begin
      insert into public.loyalty_memberships (
        business_id, customer_id, program_id, public_token, membership_number
      ) values (
        v_business.id, v_customer_id, v_program.id, v_token, v_number
      );
      exit;
    exception
      when unique_violation then
        if v_attempt = 5 then
          raise;
        end if;
    end;
  end loop;

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_business.id,
    auth.uid(),
    'customer.enrolled',
    'customer',
    v_customer_id,
    jsonb_build_object('program_id', v_program.id)
  );

  return jsonb_build_object('public_token', v_token, 'membership_number', v_number);
end;
$$;

create or replace function public.get_enrollment_profile(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_program public.loyalty_programs%rowtype;
begin
  select * into v_business from public.businesses where slug = btrim(coalesce(p_slug, ''));
  if not found then
    return null;
  end if;
  select * into v_program
  from public.loyalty_programs
  where business_id = v_business.id
    and is_primary
    and status = 'active';
  return jsonb_build_object(
    'name', v_business.name,
    'slug', v_business.slug,
    'logo_url', v_business.logo_url,
    'brand_color', v_business.brand_color,
    'brand_color_secondary', v_business.brand_color_secondary,
    'locale', v_business.locale,
    'currency', v_business.default_currency,
    'enrollment_open', v_business.status = 'active'
      and v_business.enrollment_enabled
      and v_program.id is not null,
    'program', case
      when v_program.id is null then null
      else jsonb_build_object(
        'name', v_program.name,
        'type', v_program.program_type,
        'stamps_required', v_program.stamps_required,
        'points_per_currency_unit', v_program.points_per_currency_unit,
        'min_purchase_amount', v_program.min_purchase_amount,
        'terms', v_program.terms,
        'currency', v_program.currency_code
      )
    end
  );
end;
$$;

create or replace function public.get_membership_card(p_token text, p_rate_bucket text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.loyalty_memberships%rowtype;
  v_customer public.customers%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_business public.businesses%rowtype;
begin
  perform public.consume_rate_limit(p_rate_bucket, 120, 60);
  if p_token is null or char_length(p_token) < 20 then
    return null;
  end if;
  select * into v_membership
  from public.loyalty_memberships
  where public_token = p_token
    and status = 'active';
  if not found then
    return null;
  end if;
  select * into v_customer from public.customers where id = v_membership.customer_id;
  select * into v_program from public.loyalty_programs where id = v_membership.program_id;
  select * into v_business from public.businesses where id = v_membership.business_id;
  if v_business.status <> 'active' or v_customer.status <> 'active' then
    return null;
  end if;
  return jsonb_build_object(
    'business_name', v_business.name,
    'logo_url', v_business.logo_url,
    'brand_color', v_business.brand_color,
    'brand_color_secondary', v_business.brand_color_secondary,
    'locale', v_business.locale,
    'currency', btrim(v_business.default_currency),
    'membership_number', v_membership.membership_number,
    'first_name', v_customer.first_name,
    'last_name', v_customer.last_name,
    'program_name', v_program.name,
    'program_type', v_program.program_type,
    'stamps_balance', v_membership.stamps_balance,
    'stamps_required', v_program.stamps_required,
    'points_balance', v_membership.points_balance,
    'rewards', coalesce((
      select jsonb_agg(r.name order by e.created_at)
      from public.reward_entitlements e
      join public.rewards r on r.id = e.reward_id
      where e.membership_id = v_membership.id
        and e.status = 'available'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_loyalty_program(
  p_business_id uuid,
  p_name text,
  p_program_type text,
  p_stamps_required integer,
  p_points_per_currency_unit numeric,
  p_min_purchase numeric,
  p_currency text,
  p_cooldown integer,
  p_is_primary boolean,
  p_terms text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_currency text;
  v_primary boolean;
  v_terms text;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  if not public.has_business_permission(p_business_id, 'manage_settings') then
    raise exception 'iago:not_authorized';
  end if;
  perform public.assert_business_open(p_business_id);
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 80 then
    raise exception 'iago:invalid_name';
  end if;
  if p_program_type not in ('stamps', 'points') then
    raise exception 'iago:invalid_program';
  end if;
  v_currency := upper(btrim(coalesce(p_currency, '')));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'iago:invalid_currency';
  end if;
  if p_cooldown is null or p_cooldown < 0 or p_cooldown > 86400 then
    raise exception 'iago:invalid_program';
  end if;
  if coalesce(p_min_purchase, 0) < 0 then
    raise exception 'iago:invalid_amount';
  end if;
  v_terms := nullif(btrim(coalesce(p_terms, '')), '');
  if v_terms is not null and char_length(v_terms) > 2000 then
    raise exception 'iago:invalid_program';
  end if;
  if p_program_type = 'stamps' and (p_stamps_required is null or p_stamps_required < 1 or p_stamps_required > 100) then
    raise exception 'iago:invalid_program';
  end if;
  if p_program_type = 'points' and (p_points_per_currency_unit is null or p_points_per_currency_unit <= 0) then
    raise exception 'iago:invalid_program';
  end if;

  v_primary := coalesce(p_is_primary, false);
  if not v_primary and not exists (
    select 1 from public.loyalty_programs
    where business_id = p_business_id and is_primary and status = 'active'
  ) then
    v_primary := true;
  end if;
  if v_primary then
    update public.loyalty_programs
    set is_primary = false
    where business_id = p_business_id
      and is_primary;
  end if;

  insert into public.loyalty_programs (
    business_id,
    name,
    program_type,
    is_primary,
    stamps_required,
    stamp_cooldown_seconds,
    points_per_currency_unit,
    min_purchase_amount,
    currency_code,
    terms
  ) values (
    p_business_id,
    btrim(p_name),
    p_program_type,
    v_primary,
    case when p_program_type = 'stamps' then p_stamps_required else null end,
    p_cooldown,
    case when p_program_type = 'points' then p_points_per_currency_unit else null end,
    coalesce(p_min_purchase, 0),
    v_currency,
    v_terms
  )
  returning id into v_id;

  insert into public.audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_business_id,
    auth.uid(),
    'loyalty_program.created',
    'loyalty_program',
    v_id,
    jsonb_build_object('type', p_program_type)
  );
  return v_id;
end;
$$;

create or replace function public.create_reward(
  p_program_id uuid,
  p_name text,
  p_description text,
  p_reward_type text,
  p_points_cost integer,
  p_discount_percent numeric,
  p_discount_amount numeric,
  p_inventory integer,
  p_per_customer integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_program public.loyalty_programs%rowtype;
  v_id uuid;
  v_description text;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  select * into v_program from public.loyalty_programs where id = p_program_id;
  if not found then
    raise exception 'iago:not_found';
  end if;
  if not public.has_business_permission(v_program.business_id, 'manage_settings') then
    raise exception 'iago:not_authorized';
  end if;
  perform public.assert_business_open(v_program.business_id);
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 80 then
    raise exception 'iago:invalid_name';
  end if;
  if p_reward_type not in ('free_product', 'percentage_discount', 'fixed_discount', 'exclusive_offer', 'promotion') then
    raise exception 'iago:invalid_reward';
  end if;
  if p_points_cost is not null and p_points_cost <= 0 then
    raise exception 'iago:invalid_reward';
  end if;
  if p_inventory is not null and p_inventory < 0 then
    raise exception 'iago:invalid_reward';
  end if;
  if p_per_customer is not null and p_per_customer <= 0 then
    raise exception 'iago:invalid_reward';
  end if;
  v_description := nullif(btrim(coalesce(p_description, '')), '');
  insert into public.rewards (
    business_id,
    program_id,
    name,
    description,
    reward_type,
    points_cost,
    discount_percent,
    discount_amount,
    inventory_limit,
    per_customer_limit
  ) values (
    v_program.business_id,
    v_program.id,
    btrim(p_name),
    v_description,
    p_reward_type,
    p_points_cost,
    p_discount_percent,
    p_discount_amount,
    p_inventory,
    p_per_customer
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_stamp_reward(p_program_id uuid, p_reward_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_program public.loyalty_programs%rowtype;
  v_reward public.rewards%rowtype;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  select * into v_program from public.loyalty_programs where id = p_program_id;
  if not found then
    raise exception 'iago:not_found';
  end if;
  if not public.has_business_permission(v_program.business_id, 'manage_settings') then
    raise exception 'iago:not_authorized';
  end if;
  perform public.assert_business_open(v_program.business_id);
  if v_program.program_type <> 'stamps' then
    raise exception 'iago:wrong_program';
  end if;
  select * into v_reward from public.rewards where id = p_reward_id;
  if not found or v_reward.program_id <> v_program.id then
    raise exception 'iago:invalid_reward';
  end if;
  update public.loyalty_programs
  set stamp_reward_id = v_reward.id
  where id = v_program.id;
end;
$$;

create or replace function public.update_business_branding(
  p_business_id uuid,
  p_brand_color text,
  p_brand_color_secondary text,
  p_logo_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary text;
  v_secondary text;
  v_logo text;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  if not public.has_business_permission(p_business_id, 'manage_settings') then
    raise exception 'iago:not_authorized';
  end if;
  perform public.assert_business_open(p_business_id);
  v_primary := nullif(btrim(coalesce(p_brand_color, '')), '');
  v_secondary := nullif(btrim(coalesce(p_brand_color_secondary, '')), '');
  v_logo := nullif(btrim(coalesce(p_logo_url, '')), '');
  if v_primary is not null and v_primary !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'iago:invalid_color';
  end if;
  if v_secondary is not null and v_secondary !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'iago:invalid_color';
  end if;
  if v_logo is not null and (char_length(v_logo) > 500 or v_logo !~ '^https://\S+$') then
    raise exception 'iago:invalid_logo';
  end if;
  update public.businesses
  set brand_color = v_primary,
      brand_color_secondary = v_secondary,
      logo_url = v_logo
  where id = p_business_id;
end;
$$;

create or replace function public.staff_add_stamp(
  p_token text,
  p_idempotency_key text,
  p_confirm boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.loyalty_memberships%rowtype;
  v_program public.loyalty_programs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  select * into v_membership from public.loyalty_memberships where public_token = p_token;
  if not found or v_membership.status <> 'active' then
    raise exception 'iago:not_found';
  end if;
  if not public.has_business_permission(v_membership.business_id, 'issue_stamps') then
    raise exception 'iago:not_authorized';
  end if;
  perform public.assert_business_open(v_membership.business_id);
  select * into v_program from public.loyalty_programs where id = v_membership.program_id;
  if v_program.program_type <> 'stamps' or v_program.status <> 'active' then
    raise exception 'iago:wrong_program';
  end if;
  if not v_program.allow_manual_stamps then
    raise exception 'iago:manual_stamps_disabled';
  end if;
  return public.post_loyalty(
    v_membership.id,
    'stamp_added',
    0,
    1,
    null,
    null,
    null,
    null,
    'manual',
    p_idempotency_key,
    null,
    null,
    auth.uid(),
    true,
    p_confirm
  );
end;
$$;

create or replace function public.staff_record_purchase(
  p_token text,
  p_amount numeric,
  p_idempotency_key text,
  p_external_reference text,
  p_confirm boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.loyalty_memberships%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_points integer;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  select * into v_membership from public.loyalty_memberships where public_token = p_token;
  if not found or v_membership.status <> 'active' then
    raise exception 'iago:not_found';
  end if;
  if not public.has_business_permission(v_membership.business_id, 'issue_points') then
    raise exception 'iago:not_authorized';
  end if;
  perform public.assert_business_open(v_membership.business_id);
  select * into v_program from public.loyalty_programs where id = v_membership.program_id;
  if v_program.program_type <> 'points' or v_program.status <> 'active' then
    raise exception 'iago:wrong_program';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'iago:invalid_amount';
  end if;
  if p_amount < v_program.min_purchase_amount then
    raise exception 'iago:below_minimum';
  end if;
  v_points := floor(p_amount * v_program.points_per_currency_unit)::integer;
  if v_program.max_points_per_transaction is not null then
    v_points := least(v_points, v_program.max_points_per_transaction);
  end if;
  if v_points < 1 then
    raise exception 'iago:below_minimum';
  end if;
  return public.post_loyalty(
    v_membership.id,
    'points_earned',
    v_points,
    0,
    round(p_amount, 2),
    v_program.currency_code,
    null,
    null,
    'manual',
    p_idempotency_key,
    p_external_reference,
    null,
    auth.uid(),
    true,
    p_confirm
  );
end;
$$;

create or replace function public.staff_redeem(
  p_token text,
  p_entitlement_id uuid,
  p_reward_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.loyalty_memberships%rowtype;
  v_entitlement public.reward_entitlements%rowtype;
  v_reward public.rewards%rowtype;
  v_existing uuid;
  v_result jsonb;
  v_redeemed integer;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  perform public.assert_idempotency_key(p_idempotency_key);
  if (p_entitlement_id is null) = (p_reward_id is null) then
    raise exception 'iago:invalid_reward';
  end if;
  select * into v_membership
  from public.loyalty_memberships
  where public_token = p_token
  for update;
  if not found or v_membership.status <> 'active' then
    raise exception 'iago:not_found';
  end if;
  if not public.has_business_permission(v_membership.business_id, 'redeem') then
    raise exception 'iago:not_authorized';
  end if;
  perform public.assert_business_open(v_membership.business_id);

  select id into v_existing
  from public.loyalty_transactions
  where business_id = v_membership.business_id
    and idempotency_key = p_idempotency_key
    and membership_id = v_membership.id;
  if found then
    return public.loyalty_result(v_existing, true);
  end if;

  if p_entitlement_id is not null then
    select * into v_entitlement
    from public.reward_entitlements
    where id = p_entitlement_id
    for update;
    if not found
      or v_entitlement.membership_id <> v_membership.id
      or v_entitlement.status <> 'available' then
      raise exception 'iago:reward_unavailable';
    end if;
    update public.reward_entitlements
    set status = 'redeemed',
        redeemed_at = now()
    where id = v_entitlement.id;
    v_result := public.post_loyalty(
      v_membership.id,
      'reward_redeemed',
      0,
      0,
      null,
      null,
      v_entitlement.reward_id,
      v_entitlement.id,
      'manual',
      p_idempotency_key,
      null,
      null,
      auth.uid(),
      false,
      true
    );
    update public.reward_entitlements
    set redeemed_transaction_id = (v_result ->> 'transaction_id')::uuid
    where id = v_entitlement.id;
    return v_result;
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id
  for update;
  if not found
    or v_reward.program_id <> v_membership.program_id
    or not v_reward.active
    or v_reward.points_cost is null
    or (v_reward.starts_at is not null and v_reward.starts_at > now())
    or (v_reward.ends_at is not null and v_reward.ends_at <= now())
    or (v_reward.inventory_limit is not null and v_reward.redeemed_count >= v_reward.inventory_limit) then
    raise exception 'iago:reward_unavailable';
  end if;
  if v_reward.per_customer_limit is not null then
    select count(*) into v_redeemed
    from public.loyalty_transactions
    where membership_id = v_membership.id
      and reward_id = v_reward.id
      and type = 'reward_redeemed';
    if v_redeemed >= v_reward.per_customer_limit then
      raise exception 'iago:reward_unavailable';
    end if;
  end if;
  if v_membership.points_balance < v_reward.points_cost then
    raise exception 'iago:insufficient_balance';
  end if;
  update public.rewards
  set redeemed_count = redeemed_count + 1
  where id = v_reward.id;
  return public.post_loyalty(
    v_membership.id,
    'reward_redeemed',
    -v_reward.points_cost,
    0,
    v_reward.discount_amount,
    null,
    v_reward.id,
    null,
    'manual',
    p_idempotency_key,
    null,
    v_reward.name,
    auth.uid(),
    false,
    true
  );
end;
$$;

create or replace function public.staff_lookup(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.loyalty_memberships%rowtype;
  v_customer public.customers%rowtype;
  v_program public.loyalty_programs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  select * into v_membership from public.loyalty_memberships where public_token = p_token and status = 'active';
  if not found then
    raise exception 'iago:not_found';
  end if;
  if not public.has_business_permission(v_membership.business_id, 'scan') then
    raise exception 'iago:not_authorized';
  end if;
  select * into v_customer from public.customers where id = v_membership.customer_id;
  select * into v_program from public.loyalty_programs where id = v_membership.program_id;
  return jsonb_build_object(
    'first_name', v_customer.first_name,
    'last_name', v_customer.last_name,
    'membership_number', v_membership.membership_number,
    'stamps_balance', v_membership.stamps_balance,
    'points_balance', v_membership.points_balance,
    'stamps_required', v_program.stamps_required,
    'program_type', v_program.program_type,
    'program_name', v_program.name,
    'currency', btrim(v_program.currency_code),
    'entitlements', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', e.id, 'name', coalesce(r.name, 'Reward'))
        order by e.created_at
      )
      from public.reward_entitlements e
      left join public.rewards r on r.id = e.reward_id
      where e.membership_id = v_membership.id
        and e.status = 'available'
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', r.id, 'name', r.name, 'points_cost', r.points_cost)
        order by r.name
      )
      from public.rewards r
      where r.program_id = v_membership.program_id
        and r.active
        and r.points_cost is not null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_stamp_code(
  p_business_id uuid,
  p_program_id uuid,
  p_label text,
  p_kind text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_program public.loyalty_programs%rowtype;
  v_code text;
  v_expires timestamptz;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'iago:not_authenticated';
  end if;
  if not public.has_business_permission(p_business_id, 'issue_stamps') then
    raise exception 'iago:not_authorized';
  end if;
  perform public.assert_business_open(p_business_id);
  if p_kind not in ('static', 'rotating') then
    raise exception 'iago:invalid_stamp_code';
  end if;
  select * into v_program from public.loyalty_programs where id = p_program_id;
  if not found or v_program.business_id <> p_business_id or v_program.program_type <> 'stamps' or v_program.status <> 'active' then
    raise exception 'iago:wrong_program';
  end if;
  v_label := nullif(left(btrim(coalesce(p_label, '')), 80), '');
  v_code := public.random_token(18);
  v_expires := case when p_kind = 'rotating' then now() + interval '60 seconds' else null end;
  insert into public.stamp_codes (business_id, program_id, label, kind, code, expires_at)
  values (p_business_id, p_program_id, v_label, p_kind, v_code, v_expires);
  return jsonb_build_object('code', v_code, 'kind', p_kind, 'expires_at', v_expires, 'label', v_label);
end;
$$;

create or replace function public.get_stamp_preview(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.stamp_codes%rowtype;
  v_business public.businesses%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_usable boolean;
begin
  if p_code is null or char_length(p_code) < 16 then
    return null;
  end if;
  select * into v_code from public.stamp_codes where code = p_code;
  if not found then
    return null;
  end if;
  select * into v_business from public.businesses where id = v_code.business_id;
  select * into v_program from public.loyalty_programs where id = v_code.program_id;
  v_usable := v_business.status = 'active'
    and v_program.status = 'active'
    and v_program.program_type = 'stamps'
    and (
      v_code.kind <> 'rotating'
      or (
        v_code.used_at is null
        and (v_code.expires_at is null or v_code.expires_at > now())
      )
    );
  return jsonb_build_object(
    'business_name', v_business.name,
    'logo_url', v_business.logo_url,
    'brand_color', v_business.brand_color,
    'brand_color_secondary', v_business.brand_color_secondary,
    'locale', v_business.locale,
    'label', v_code.label,
    'kind', v_code.kind,
    'usable', v_usable
  );
end;
$$;

create or replace function public.collect_stamp(
  p_card_token text,
  p_code text,
  p_source text,
  p_idempotency_key text,
  p_rate_bucket text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.loyalty_memberships%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_code public.stamp_codes%rowtype;
  v_existing uuid;
  v_result jsonb;
begin
  perform public.consume_rate_limit(p_rate_bucket, 30, 60);
  perform public.assert_idempotency_key(p_idempotency_key);
  if p_source not in ('customer_qr', 'customer_nfc') then
    raise exception 'iago:invalid_source';
  end if;
  select * into v_membership
  from public.loyalty_memberships
  where public_token = p_card_token
    and status = 'active';
  if not found then
    raise exception 'iago:not_found';
  end if;
  perform public.assert_business_open(v_membership.business_id);

  select id into v_existing
  from public.loyalty_transactions
  where business_id = v_membership.business_id
    and idempotency_key = p_idempotency_key
    and membership_id = v_membership.id;
  if found then
    return public.loyalty_result(v_existing, true);
  end if;

  select * into v_code
  from public.stamp_codes
  where code = p_code
  for update;
  if not found
    or v_code.business_id <> v_membership.business_id
    or v_code.program_id <> v_membership.program_id then
    raise exception 'iago:stamp_code_invalid';
  end if;
  select * into v_program from public.loyalty_programs where id = v_membership.program_id;
  if v_program.program_type <> 'stamps' or v_program.status <> 'active' then
    raise exception 'iago:wrong_program';
  end if;
  if v_code.kind = 'rotating' then
    if v_code.expires_at is not null and v_code.expires_at <= now() then
      raise exception 'iago:stamp_code_expired';
    end if;
    if v_code.used_at is not null then
      raise exception 'iago:stamp_code_used';
    end if;
  elsif v_program.stamp_cooldown_seconds > 0 and exists (
    select 1
    from public.stamp_collections
    where membership_id = v_membership.id
      and stamp_code_id = v_code.id
      and collected_at > now() - make_interval(secs => v_program.stamp_cooldown_seconds)
  ) then
    raise exception 'iago:stamp_cooldown';
  end if;

  v_result := public.post_loyalty(
    v_membership.id,
    'stamp_added',
    0,
    1,
    null,
    null,
    null,
    null,
    p_source,
    p_idempotency_key,
    null,
    v_code.label,
    null,
    false,
    false
  );
  if coalesce((v_result ->> 'idempotent')::boolean, false) then
    return v_result;
  end if;
  if v_code.kind = 'rotating' then
    update public.stamp_codes set used_at = now() where id = v_code.id;
  end if;
  insert into public.stamp_collections (business_id, membership_id, stamp_code_id)
  values (v_membership.business_id, v_membership.id, v_code.id);
  return v_result;
end;
$$;

alter table public.customers enable row level security;
alter table public.loyalty_programs enable row level security;
alter table public.rewards enable row level security;
alter table public.loyalty_memberships enable row level security;
alter table public.reward_entitlements enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.consent_records enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.stamp_codes enable row level security;
alter table public.stamp_collections enable row level security;
alter table public.rate_limits enable row level security;

alter table public.customers force row level security;
alter table public.loyalty_programs force row level security;
alter table public.rewards force row level security;
alter table public.loyalty_memberships force row level security;
alter table public.reward_entitlements force row level security;
alter table public.loyalty_transactions force row level security;
alter table public.consent_records force row level security;
alter table public.notification_preferences force row level security;
alter table public.stamp_codes force row level security;
alter table public.stamp_collections force row level security;
alter table public.rate_limits force row level security;

create policy customers_select on public.customers
  for select to authenticated
  using (public.has_business_permission(business_id, 'view_customers'));

create policy loyalty_programs_select on public.loyalty_programs
  for select to authenticated
  using (public.is_platform_admin() or public.shares_business(business_id));

create policy rewards_select on public.rewards
  for select to authenticated
  using (public.is_platform_admin() or public.shares_business(business_id));

create policy loyalty_memberships_select on public.loyalty_memberships
  for select to authenticated
  using (public.has_business_permission(business_id, 'view_customers'));

create policy reward_entitlements_select on public.reward_entitlements
  for select to authenticated
  using (public.has_business_permission(business_id, 'view_customers'));

create policy loyalty_transactions_select on public.loyalty_transactions
  for select to authenticated
  using (public.is_platform_admin() or public.shares_business(business_id));

create policy consent_records_select on public.consent_records
  for select to authenticated
  using (public.has_business_permission(business_id, 'view_customers'));

create policy notification_preferences_select on public.notification_preferences
  for select to authenticated
  using (public.has_business_permission(business_id, 'view_customers'));

create policy stamp_codes_select on public.stamp_codes
  for select to authenticated
  using (public.has_business_permission(business_id, 'issue_stamps'));

create policy stamp_collections_select on public.stamp_collections
  for select to authenticated
  using (public.has_business_permission(business_id, 'issue_stamps'));

revoke all on public.customers, public.loyalty_programs, public.rewards, public.loyalty_memberships,
  public.reward_entitlements, public.loyalty_transactions, public.consent_records,
  public.notification_preferences, public.stamp_codes, public.stamp_collections, public.rate_limits
  from public, anon, authenticated;

grant select on public.customers, public.loyalty_programs, public.rewards, public.loyalty_memberships,
  public.reward_entitlements, public.loyalty_transactions, public.consent_records,
  public.notification_preferences, public.stamp_codes, public.stamp_collections
  to authenticated;

revoke all on all functions in schema public from public;

grant execute on function public.enroll_customer(text, text, text, text, text, date, boolean, boolean, boolean, boolean, text) to anon, authenticated;
grant execute on function public.get_enrollment_profile(text) to anon, authenticated;
grant execute on function public.get_membership_card(text, text) to anon, authenticated;
grant execute on function public.get_stamp_preview(text) to anon, authenticated;
grant execute on function public.collect_stamp(text, text, text, text, text) to anon, authenticated;
grant execute on function public.create_loyalty_program(uuid, text, text, integer, numeric, numeric, text, integer, boolean, text) to authenticated;
grant execute on function public.create_reward(uuid, text, text, text, integer, numeric, numeric, integer, integer) to authenticated;
grant execute on function public.set_stamp_reward(uuid, uuid) to authenticated;
grant execute on function public.update_business_branding(uuid, text, text, text) to authenticated;
grant execute on function public.staff_add_stamp(text, text, boolean) to authenticated;
grant execute on function public.staff_record_purchase(text, numeric, text, text, boolean) to authenticated;
grant execute on function public.staff_redeem(text, uuid, uuid, text) to authenticated;
grant execute on function public.staff_lookup(text) to authenticated;
grant execute on function public.create_stamp_code(uuid, uuid, text, text) to authenticated;
