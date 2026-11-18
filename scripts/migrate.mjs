import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

const url =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  "";
if (url === "") {
  console.log("migrate: nothing to do");
  process.exit(0);
}

const roleSetup = `
do $iago_roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not pg_has_role(current_user, 'anon', 'member') then
    grant anon to current_user;
  end if;
  if not pg_has_role(current_user, 'authenticated', 'member') then
    grant authenticated to current_user;
  end if;
end
$iago_roles$;
`;

// The published database has one login, and that login owns the tables.
// Security-definer functions run as the owner. Forced row security would make
// the owner subject to policies written only for anon and authenticated, so
// the ledger functions and the first admin profile insert would fail. Tenant
// queries still switch into those roles, and row security stays enabled.
const ownerFunctions = `
do $iago_owner$
declare
  table_row record;
begin
  for table_row in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relforcerowsecurity
  loop
    execute format(
      'alter table %I.%I no force row level security',
      table_row.schema_name,
      table_row.table_name
    );
  end loop;
end
$iago_owner$;
`;

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql`set lock_timeout = '60s'`;
  await sql`select pg_advisory_lock(7272741)`;
  await sql`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const migrationFiles = (await readdir("supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({ name: file, path: `supabase/migrations/${file}` }));
  const steps = [
    { name: "000_hosted_roles.sql", body: roleSetup },
    { name: "001_local_auth_prelude.sql", path: "supabase/local/prelude.sql" },
    ...migrationFiles,
  ];

  const applied = new Set(
    (await sql`select name from public.schema_migrations`).map((row) => row.name),
  );

  for (const step of steps) {
    if (applied.has(step.name)) {
      continue;
    }
    const body = step.body ?? (await readFile(step.path, "utf8"));
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public.schema_migrations (name) values (${step.name})`;
    });
    console.log(`migrate: applied ${step.name}`);
  }

  await sql.unsafe(ownerFunctions);
  await sql`select pg_advisory_unlock(7272741)`;
} finally {
  await sql.end({ timeout: 5 });
}
