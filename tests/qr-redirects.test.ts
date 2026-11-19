import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
  const migrationDir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
  const migrations = readdirSync(migrationDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));

  await admin.unsafe("drop schema if exists public cascade");
  await admin.unsafe("drop schema if exists auth cascade");
  await admin.unsafe("create schema public");
  await admin.unsafe("grant all on schema public to postgres");
  await admin.unsafe("grant usage on schema public to public");
  await admin.unsafe(prelude);
  for (const body of migrations) {
    await admin.unsafe(body);
  }
}

async function asUser<T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) {
  return app.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx.unsafe("set local role authenticated");
    return run(tx);
  });
}

async function asAnon<T>(run: (tx: postgres.TransactionSql) => Promise<T>) {
  return app.begin(async (tx) => {
    await tx.unsafe("set local role anon");
    return run(tx);
  });
}

test("qr redirects stay permanent while destinations change", async (t) => {
  await applySchema();
  await admin`
    insert into auth.users (id, email, raw_user_meta_data)
    values
      ('00000000-0000-4000-8000-0000000000a1', 'admin@iagodigital.com', '{"full_name":"Platform Admin"}'),
      ('00000000-0000-4000-8000-0000000000a2', 'owner@example.com', '{"full_name":"Owner"}')
  `;
  await admin`
    update public.profiles
    set platform_role = 'super_admin'
    where id = '00000000-0000-4000-8000-0000000000a1'
  `;

  const adminId = "00000000-0000-4000-8000-0000000000a1";
  const ownerId = "00000000-0000-4000-8000-0000000000a2";

  await t.test("platform admin creates an auto-numbered Google Reviews destination", async () => {
    const rows = await asUser(adminId, (tx) =>
      tx<{ create_qr_redirect: { id: string; code: string; destination_url: string } }[]>`
        select public.create_qr_redirect(
          'Perfumes y Belleza',
          'google_reviews',
          'https://search.google.com/local/writereview?placeid=ChIJTest',
          'active',
          null,
          null
        ) as create_qr_redirect
      `,
    );
    assert.equal(rows[0].create_qr_redirect.code, "001");
    assert.equal(
      rows[0].create_qr_redirect.destination_url,
      "https://search.google.com/local/writereview?placeid=ChIJTest",
    );
  });

  await t.test("anon resolve returns the live destination for active codes", async () => {
    const rows = await asAnon((tx) =>
      tx<{ resolve_qr_redirect: { code: string; destination_url: string } | null }[]>`
        select public.resolve_qr_redirect('001') as resolve_qr_redirect
      `,
    );
    assert.equal(rows[0].resolve_qr_redirect?.code, "001");
    assert.equal(
      rows[0].resolve_qr_redirect?.destination_url,
      "https://search.google.com/local/writereview?placeid=ChIJTest",
    );
  });

  await t.test("updating the destination keeps the same permanent code", async () => {
    const listed = await asUser(adminId, (tx) =>
      tx<{ id: string; code: string }[]>`
        select id, code from public.qr_redirects where code = '001'
      `,
    );
    const id = listed[0].id;
    const updated = await asUser(adminId, (tx) =>
      tx<{ update_qr_redirect: { code: string; destination_url: string; business_name: string } }[]>`
        select public.update_qr_redirect(
          ${id}::uuid,
          'Cafe Centro',
          'website',
          'https://cafecentro.example',
          'active',
          null
        ) as update_qr_redirect
      `,
    );
    assert.equal(updated[0].update_qr_redirect.code, "001");
    assert.equal(updated[0].update_qr_redirect.business_name, "Cafe Centro");
    assert.equal(updated[0].update_qr_redirect.destination_url, "https://cafecentro.example");

    const resolved = await asAnon((tx) =>
      tx<{ resolve_qr_redirect: { destination_url: string } | null }[]>`
        select public.resolve_qr_redirect('001') as resolve_qr_redirect
      `,
    );
    assert.equal(resolved[0].resolve_qr_redirect?.destination_url, "https://cafecentro.example");
  });

  await t.test("inactive destinations do not resolve", async () => {
    const listed = await asUser(adminId, (tx) =>
      tx<{ id: string }[]>`select id from public.qr_redirects where code = '001'`,
    );
    await asUser(adminId, (tx) =>
      tx`
        select public.update_qr_redirect(
          ${listed[0].id}::uuid,
          'Cafe Centro',
          'website',
          'https://cafecentro.example',
          'inactive',
          null
        )
      `,
    );
    const resolved = await asAnon((tx) =>
      tx<{ resolve_qr_redirect: unknown }[]>`
        select public.resolve_qr_redirect('001') as resolve_qr_redirect
      `,
    );
    assert.equal(resolved[0].resolve_qr_redirect, null);
  });

  await t.test("non-http destinations are rejected", async () => {
    await assert.rejects(
      () =>
        asUser(adminId, (tx) =>
          tx`
            select public.create_qr_redirect(
              'Bad Link',
              'custom',
              'javascript:alert(1)',
              'active',
              'bad1',
              null
            )
          `,
        ),
      /iago:invalid_destination_url/,
    );
  });

  await t.test("business owners cannot manage platform QR destinations", async () => {
    await assert.rejects(
      () =>
        asUser(ownerId, (tx) =>
          tx`
            select public.create_qr_redirect(
              'Owner Cafe',
              'custom',
              'https://example.com',
              'active',
              'own1',
              null
            )
          `,
        ),
      /iago:not_authorized/,
    );
  });

  await t.test("a QR can be created without a destination and resolved as a placeholder", async () => {
    const rows = await asUser(adminId, (tx) =>
      tx<{ create_qr_redirect: { code: string; destination_url: string | null } }[]>`
        select public.create_qr_redirect(
          'Perfumes y Belleza',
          'google_reviews',
          null,
          'active',
          null,
          null
        ) as create_qr_redirect
      `,
    );
    assert.equal(rows[0].create_qr_redirect.code, "002");
    assert.equal(rows[0].create_qr_redirect.destination_url, null);

    const resolved = await asAnon((tx) =>
      tx<{ resolve_qr_redirect: { code: string; destination_url: string | null; placeholder: boolean } | null }[]>`
        select public.resolve_qr_redirect('002') as resolve_qr_redirect
      `,
    );
    assert.equal(resolved[0].resolve_qr_redirect?.code, "002");
    assert.equal(resolved[0].resolve_qr_redirect?.destination_url, null);
    assert.equal(resolved[0].resolve_qr_redirect?.placeholder, true);
  });

  await t.test("batch create assigns ten permanent codes with no destination yet", async () => {
    const rows = await asUser(adminId, (tx) =>
      tx<{ create_qr_redirect_batch: { codes: string[] } }[]>`
        select public.create_qr_redirect_batch(
          10,
          'Perfumes y Belleza',
          'google_reviews',
          'active',
          null
        ) as create_qr_redirect_batch
      `,
    );
    assert.deepEqual(rows[0].create_qr_redirect_batch.codes, [
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
    ]);
  });

  await t.test("a placeholder QR can later point at Google without changing the code", async () => {
    const listed = await asUser(adminId, (tx) =>
      tx<{ id: string }[]>`select id from public.qr_redirects where code = '002'`,
    );
    const updated = await asUser(adminId, (tx) =>
      tx<{ update_qr_redirect: { code: string; destination_url: string } }[]>`
        select public.update_qr_redirect(
          ${listed[0].id}::uuid,
          'Perfumes y Belleza',
          'google_reviews',
          'https://search.google.com/local/writereview?placeid=ChIJLive',
          'active',
          null
        ) as update_qr_redirect
      `,
    );
    assert.equal(updated[0].update_qr_redirect.code, "002");
    assert.equal(
      updated[0].update_qr_redirect.destination_url,
      "https://search.google.com/local/writereview?placeid=ChIJLive",
    );
  });
});

test.after(async () => {
  await admin.end({ timeout: 1 });
  await app.end({ timeout: 1 });
});
