import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";

const adminUrl =
  process.env.LOCAL_DATABASE_ADMIN_URL ??
  "postgres://postgres@127.0.0.1:5432/iago_loyalty_test";
const appUrl =
  process.env.LOCAL_DATABASE_URL ??
  "postgres://iago_app:iago_local_dev_only@127.0.0.1:5432/iago_loyalty_test";

const admin = postgres(adminUrl, { max: 1, prepare: false });
const app = postgres(appUrl, { max: 1, prepare: false });

async function applySchema() {
  const prelude = readFileSync(new URL("../supabase/local/prelude.sql", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../supabase/migrations/20261115000000_foundation.sql", import.meta.url),
    "utf8",
  );
  await admin.unsafe("drop schema if exists public cascade");
  await admin.unsafe("drop schema if exists auth cascade");
  await admin.unsafe("create schema public");
  await admin.unsafe("grant all on schema public to postgres");
  await admin.unsafe("grant usage on schema public to public");
  await admin.unsafe(prelude);
  await admin.unsafe(migration);
}

async function asUser<T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) {
  return app.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx.unsafe("set local role authenticated");
    return run(tx);
  });
}

test("tenant isolation, suspension, and invitations", async (t) => {
  await applySchema();
  await admin`
    insert into auth.users (id, email, raw_user_meta_data)
    values
      ('00000000-0000-4000-8000-000000000001', 'admin@iagodigital.com', '{"full_name":"Platform Admin"}'),
      ('00000000-0000-4000-8000-000000000002', 'owner-a@example.com', '{"full_name":"Owner A"}'),
      ('00000000-0000-4000-8000-000000000003', 'owner-b@example.com', '{"full_name":"Owner B"}')
  `;
  await admin`
    update public.profiles
    set platform_role = 'super_admin'
    where id = '00000000-0000-4000-8000-000000000001'
  `;

  const created = await asUser("00000000-0000-4000-8000-000000000001", (tx) =>
    tx<{ create_business: { business_id: string; invitation_token: string } }[]>`
      select public.create_business(
        'Cafe Norte',
        'cafe-norte',
        'America/Tegucigalpa',
        'HNL',
        'es',
        'hola@cafe-norte.test',
        'owner-a@example.com'
      ) as create_business
    `,
  );
  const businessA = created[0].create_business.business_id;
  const tokenA = created[0].create_business.invitation_token;
  assert.equal(typeof tokenA, "string");
  assert.ok(tokenA.length >= 32);

  const second = await asUser("00000000-0000-4000-8000-000000000001", (tx) =>
    tx<{ create_business: { business_id: string; invitation_token: string } }[]>`
      select public.create_business(
        'Salon Sur',
        'salon-sur',
        'America/Tegucigalpa',
        'USD',
        'es',
        null,
        'owner-b@example.com'
      ) as create_business
    `,
  );
  const businessB = second[0].create_business.business_id;

  await asUser("00000000-0000-4000-8000-000000000002", (tx) =>
    tx`select public.accept_invitation(${tokenA})`,
  );

  const tokenB = second[0].create_business.invitation_token;
  await asUser("00000000-0000-4000-8000-000000000003", (tx) =>
    tx`select public.accept_invitation(${tokenB})`,
  );

  await t.test("a business owner cannot read another business", async () => {
    const visible = await asUser("00000000-0000-4000-8000-000000000002", (tx) =>
      tx<{ id: string }[]>`select id from public.businesses`,
    );
    assert.deepEqual(visible.map((row) => row.id), [businessA]);
  });

  await t.test("a business owner cannot invite itself into another business", async () => {
    await assert.rejects(
      () =>
        asUser("00000000-0000-4000-8000-000000000002", (tx) =>
          tx`select public.create_invitation(${businessB}, 'spy@example.com', 'employee', '{}'::jsonb)`,
        ),
      /iago:not_authorized/,
    );
  });

  await t.test("the app role without a user context cannot read tenant rows", async () => {
    await assert.rejects(
      () => app`select id from public.businesses`,
      /permission denied|42501/i,
    );
  });

  await t.test("suspending a business blocks owner writes and keeps reads", async () => {
    await asUser("00000000-0000-4000-8000-000000000001", (tx) =>
      tx`select public.set_business_status(${businessA}::uuid, 'suspended')`,
    );
    const stillVisible = await asUser("00000000-0000-4000-8000-000000000002", (tx) =>
      tx<{ status: string }[]>`select status from public.businesses where id = ${businessA}`,
    );
    assert.equal(stillVisible[0]?.status, "suspended");
    await assert.rejects(
      () =>
        asUser("00000000-0000-4000-8000-000000000002", (tx) =>
          tx`select public.update_business_profile(
            ${businessA}::uuid,
            'Cafe Norte Renamed',
            'America/Tegucigalpa',
            'HNL',
            'es',
            null
          )`,
        ),
      /iago:business_suspended/,
    );
  });

  await t.test("an employee cannot read the audit log", async () => {
    const invite = await asUser("00000000-0000-4000-8000-000000000001", (tx) =>
      tx<{ create_invitation: string }[]>`
        select public.create_invitation(
          ${businessB}::uuid,
          'clerk@example.com',
          'employee',
          '{"scan": true}'::jsonb
        ) as create_invitation
      `,
    );
    await admin`
      insert into auth.users (id, email, raw_user_meta_data)
      values ('00000000-0000-4000-8000-000000000004', 'clerk@example.com', '{"full_name":"Clerk"}')
    `;
    await asUser("00000000-0000-4000-8000-000000000004", (tx) =>
      tx`select public.accept_invitation(${invite[0].create_invitation})`,
    );
    const logs = await asUser("00000000-0000-4000-8000-000000000004", (tx) =>
      tx<{ id: string }[]>`select id from public.audit_logs`,
    );
    assert.equal(logs.length, 0);
  });
});

test.after(async () => {
  await admin.end({ timeout: 1 });
  await app.end({ timeout: 1 });
});
