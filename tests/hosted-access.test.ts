import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";
import postgres from "postgres";
import { accountMode, getDataMode } from "../src/lib/config.ts";

const superUrl = "postgres://postgres@127.0.0.1:5432/postgres";
const hostedUrl = "postgres://hosted_owner:hosted_owner_test@127.0.0.1:5432/iago_hosted_test";
const adminId = "11111111-1111-4111-8111-111111111111";

describe("hosted sign-in", { concurrency: false }, () => {
test("production database accounts stay available when Supabase is unset", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    LOCAL_DATABASE_URL: process.env.LOCAL_DATABASE_URL,
    LOCAL_DATABASE_ADMIN_URL: process.env.LOCAL_DATABASE_ADMIN_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgres://hosted.example/iago";
  process.env.SESSION_SECRET = "x".repeat(32);
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    assert.equal(getDataMode(), "hosted");
    assert.equal(accountMode(), "database");
  } finally {
    restoreEnv(previous);
  }
});

test("Vercel Neon POSTGRES_URL is enough for hosted mode", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    LOCAL_DATABASE_URL: process.env.LOCAL_DATABASE_URL,
    LOCAL_DATABASE_ADMIN_URL: process.env.LOCAL_DATABASE_ADMIN_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  process.env.NODE_ENV = "production";
  delete process.env.DATABASE_URL;
  process.env.POSTGRES_URL = "postgres://neon.example/iago";
  process.env.SESSION_SECRET = "x".repeat(32);
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    assert.equal(getDataMode(), "hosted");
    assert.equal(accountMode(), "database");
  } finally {
    restoreEnv(previous);
  }
});

test("hosted database can create the admin and Perfumes y Belleza under row security", async () => {
  const root = postgres(superUrl, { max: 1, prepare: false });
  await root`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'hosted_owner') then
        create role hosted_owner login password 'hosted_owner_test' nosuperuser;
      end if;
    end
    $$;
  `;
  await root`grant anon to hosted_owner`;
  await root`grant authenticated to hosted_owner`;
  await root`
    select pg_terminate_backend(pid)
    from pg_stat_activity
    where datname = 'iago_hosted_test' and pid <> pg_backend_pid()
  `;
  await root.unsafe("drop database if exists iago_hosted_test");
  await root.unsafe("create database iago_hosted_test owner hosted_owner");
  await root.end();

  const setup = postgres("postgres://postgres@127.0.0.1:5432/iago_hosted_test", {
    max: 1,
    prepare: false,
  });
  await setup.unsafe("alter schema public owner to hosted_owner");
  await setup.unsafe("grant all on schema public to hosted_owner");
  await setup.end();

  const migrated = spawnSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: hostedUrl },
    encoding: "utf8",
  });
  assert.equal(migrated.status, 0, migrated.stderr || migrated.stdout);

  const db = postgres(hostedUrl, { max: 1, prepare: false });
  try {
    await db`
      insert into auth.users (id, email, raw_user_meta_data)
      values (${adminId}, 'santiago.t@iagodigital.com', ${db.json({ full_name: "Santiago" })})
    `;
    await db`
      update public.profiles
      set platform_role = 'super_admin'
      where id = ${adminId}
    `;

    const created = await db.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${adminId}, true)`;
      await tx.unsafe("set local role authenticated");
      return tx<{ create_business: { business_id: string } }[]>`
        select public.create_business(
          'Perfumes y Belleza',
          'perfumes-y-belleza',
          'America/Tegucigalpa',
          'HNL',
          'es',
          'santiago.t@iagodigital.com',
          'santiago.t@iagodigital.com'
        ) as create_business
      `;
    });
    assert.ok(created[0]?.create_business.business_id);

    await assert.rejects(
      db.begin(async (tx) => {
        await tx.unsafe("set local role anon");
        return tx`select count(*)::int as count from public.businesses`;
      }),
      (error: unknown) => {
        assert.equal(error instanceof Error ? error.message : "", "permission denied for table businesses");
        return true;
      },
    );

    const visible = await db.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${adminId}, true)`;
      await tx.unsafe("set local role authenticated");
      return tx<{ name: string; slug: string }[]>`
        select name, slug from public.businesses
      `;
    });
    assert.equal(visible[0]?.name, "Perfumes y Belleza");
    assert.equal(visible[0]?.slug, "perfumes-y-belleza");
  } finally {
    await db.end();
    const cleanup = postgres(superUrl, { max: 1, prepare: false });
    await cleanup`
      select pg_terminate_backend(pid)
      from pg_stat_activity
      where datname = 'iago_hosted_test' and pid <> pg_backend_pid()
    `;
    await cleanup.unsafe("drop database if exists iago_hosted_test");
    await cleanup.end();
  }
});
});

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
