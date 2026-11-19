#!/bin/sh
set -eu

sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'iago_app') then
    create role iago_app login password 'iago_local_dev_only' noinherit;
  end if;
end
$$;
alter role iago_app with login password 'iago_local_dev_only' noinherit;
grant authenticated to iago_app with set true, inherit false;
grant anon to iago_app with set true, inherit false;
select 'create database iago_loyalty' where not exists (select 1 from pg_database where datname = 'iago_loyalty')\gexec
select 'create database iago_loyalty_test' where not exists (select 1 from pg_database where datname = 'iago_loyalty_test')\gexec
grant connect on database iago_loyalty to iago_app;
grant connect on database iago_loyalty_test to iago_app;
SQL

sudo -u postgres psql -d iago_loyalty -v ON_ERROR_STOP=1 -c 'drop schema if exists public cascade'
sudo -u postgres psql -d iago_loyalty -v ON_ERROR_STOP=1 -c 'drop schema if exists auth cascade'
sudo -u postgres psql -d iago_loyalty -v ON_ERROR_STOP=1 -c 'create schema public'
sudo -u postgres psql -d iago_loyalty -v ON_ERROR_STOP=1 -f supabase/local/prelude.sql
for migration in supabase/migrations/*.sql; do
  sudo -u postgres psql -d iago_loyalty -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Local database iago_loyalty is ready."
