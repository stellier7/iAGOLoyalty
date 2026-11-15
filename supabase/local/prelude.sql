-- Local PostgreSQL stand-in for the Supabase auth schema.
-- Do not run this file against a hosted Supabase project. Hosted projects
-- already provide auth.users and auth.uid().

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists auth.local_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  password_hash text not null
);

revoke all on schema auth from public;
revoke all on auth.users from public;
revoke all on auth.local_credentials from public;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
