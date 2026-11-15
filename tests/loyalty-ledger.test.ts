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

const ADMIN = "00000000-0000-4000-8000-000000000001";
const OWNER_A = "00000000-0000-4000-8000-000000000002";
const OWNER_B = "00000000-0000-4000-8000-000000000003";
const CLERK = "00000000-0000-4000-8000-000000000004";

type LoyaltyResult = {
  transaction_id: string;
  points_balance: number;
  stamps_balance: number;
  idempotent: boolean;
  entitlement_granted: boolean;
};

type Enrollment = {
  public_token: string;
  membership_number: string;
};

type StampCode = {
  code: string;
  kind: string;
  expires_at: string | null;
};

async function applySchema() {
  const prelude = readFileSync(new URL("../supabase/local/prelude.sql", import.meta.url), "utf8");
  const foundation = readFileSync(
    new URL("../supabase/migrations/20261115000000_foundation.sql", import.meta.url),
    "utf8",
  );
  const loyalty = readFileSync(
    new URL("../supabase/migrations/20261115010000_loyalty.sql", import.meta.url),
    "utf8",
  );
  await admin.unsafe("drop schema if exists public cascade");
  await admin.unsafe("drop schema if exists auth cascade");
  await admin.unsafe("create schema public");
  await admin.unsafe("grant all on schema public to postgres");
  await admin.unsafe("grant usage on schema public to public");
  await admin.unsafe(prelude);
  await admin.unsafe(foundation);
  await admin.unsafe(loyalty);
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

function resultOf(rows: { result: LoyaltyResult }[]) {
  const result = rows[0]?.result;
  if (!result) {
    throw new Error("missing loyalty result");
  }
  return result;
}

test("loyalty ledger, enrollment, and stamp carriers", async (t) => {
  await applySchema();
  await admin`
    insert into auth.users (id, email, raw_user_meta_data)
    values
      (${ADMIN}, 'admin@iagodigital.com', '{"full_name":"Platform Admin"}'),
      (${OWNER_A}, 'owner-a@example.com', '{"full_name":"Owner A"}'),
      (${OWNER_B}, 'owner-b@example.com', '{"full_name":"Owner B"}'),
      (${CLERK}, 'clerk@example.com', '{"full_name":"Clerk"}')
  `;
  await admin`
    update public.profiles
    set platform_role = 'super_admin'
    where id = ${ADMIN}
  `;

  const createdA = await asUser(ADMIN, (tx) =>
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
  const businessA = createdA[0].create_business.business_id;
  await asUser(OWNER_A, (tx) =>
    tx`select public.accept_invitation(${createdA[0].create_business.invitation_token})`,
  );

  const createdB = await asUser(ADMIN, (tx) =>
    tx<{ create_business: { business_id: string; invitation_token: string } }[]>`
      select public.create_business(
        'Salon Sur',
        'salon-sur',
        'America/Tegucigalpa',
        'USD',
        'en',
        null,
        'owner-b@example.com'
      ) as create_business
    `,
  );
  const businessB = createdB[0].create_business.business_id;
  await asUser(OWNER_B, (tx) =>
    tx`select public.accept_invitation(${createdB[0].create_business.invitation_token})`,
  );

  const clerkInvite = await asUser(OWNER_A, (tx) =>
    tx<{ create_invitation: string }[]>`
      select public.create_invitation(
        ${businessA}::uuid,
        'clerk@example.com',
        'employee',
        '{"scan": true, "view_customers": true}'::jsonb
      ) as create_invitation
    `,
  );
  await asUser(CLERK, (tx) =>
    tx`select public.accept_invitation(${clerkInvite[0].create_invitation})`,
  );

  const stampProgram = await asUser(OWNER_A, (tx) =>
    tx<{ create_loyalty_program: string }[]>`
      select public.create_loyalty_program(
        ${businessA}::uuid,
        'Stamp card',
        'stamps',
        3,
        null,
        0,
        'HNL',
        300,
        true,
        'Three stamps, one reward.'
      ) as create_loyalty_program
    `,
  );
  const stampProgramId = stampProgram[0].create_loyalty_program;

  const stampReward = await asUser(OWNER_A, (tx) =>
    tx<{ create_reward: string }[]>`
      select public.create_reward(
        ${stampProgramId}::uuid,
        'Free sample',
        'A sample after three stamps',
        'free_product',
        null,
        null,
        null,
        null,
        null
      ) as create_reward
    `,
  );
  await asUser(OWNER_A, (tx) =>
    tx`select public.set_stamp_reward(${stampProgramId}::uuid, ${stampReward[0].create_reward}::uuid)`,
  );

  const pointsProgram = await asUser(OWNER_B, (tx) =>
    tx<{ create_loyalty_program: string }[]>`
      select public.create_loyalty_program(
        ${businessB}::uuid,
        'Points',
        'points',
        null,
        2,
        5,
        'USD',
        0,
        true,
        null
      ) as create_loyalty_program
    `,
  );
  const catalogReward = await asUser(OWNER_B, (tx) =>
    tx<{ create_reward: string }[]>`
      select public.create_reward(
        ${pointsProgram[0].create_loyalty_program}::uuid,
        'USD 5 off',
        null,
        'fixed_discount',
        21,
        null,
        5,
        10,
        1
      ) as create_reward
    `,
  );
  const catalogRewardId = catalogReward[0].create_reward;

  await t.test("enrollment requires program acceptance and a primary program", async () => {
    await assert.rejects(
      () =>
        asAnon((tx) =>
          tx`select public.enroll_customer(
            'cafe-norte', 'Ana', 'Lopez', 'ana@example.com', null, null,
            false, false, false, false, 'enroll-reject'
          )`,
        ),
      /iago:program_not_accepted/,
    );
  });

  const enrolled = await asAnon((tx) =>
    tx<{ enroll_customer: Enrollment }[]>`
      select public.enroll_customer(
        'cafe-norte',
        'Ana',
        'Lopez',
        'ana@example.com',
        '+50499990000',
        null,
        true,
        false,
        true,
        false,
        'enroll-ana'
      ) as enroll_customer
    `,
  );
  const cardToken = enrolled[0].enroll_customer.public_token;
  assert.match(cardToken, /^[A-Za-z0-9_-]{20,}$/);
  assert.match(enrolled[0].enroll_customer.membership_number, /^[A-Z0-9]+-[A-F0-9]{6}$/);

  await t.test("the same email cannot enroll twice in one business", async () => {
    await assert.rejects(
      () =>
        asAnon((tx) =>
          tx`select public.enroll_customer(
            'cafe-norte', 'Ana', 'Lopez', 'ana@example.com', null, null,
            true, false, false, false, 'enroll-ana-again'
          )`,
        ),
      /iago:already_enrolled/,
    );
  });

  await t.test("the public card hides contact details and internal ids", async () => {
    const rows = await asAnon((tx) =>
      tx<{ get_membership_card: Record<string, unknown> | null }[]>`
        select public.get_membership_card(${cardToken}, 'card-ana') as get_membership_card
      `,
    );
    const card = rows[0].get_membership_card;
    assert.ok(card);
    const serialized = JSON.stringify(card);
    assert.equal(serialized.includes("ana@example.com"), false);
    assert.equal(serialized.includes("+50499990000"), false);
    assert.equal(serialized.includes(businessA), false);
    assert.equal(card.first_name, "Ana");
    assert.equal(card.program_type, "stamps");
    assert.equal(Number(card.stamps_balance), 0);
    assert.equal(Number(card.stamps_required), 3);
  });

  await t.test("another business cannot see or stamp this customer", async () => {
    const visible = await asUser(OWNER_B, (tx) =>
      tx<{ email: string }[]>`select email::text as email from public.customers`,
    );
    assert.equal(visible.length, 0);
    await assert.rejects(
      () => asUser(OWNER_B, (tx) => tx`select public.staff_add_stamp(${cardToken}, 'cross-tenant-stamp', true)`),
      /iago:not_authorized/,
    );
  });

  await t.test("a clerk without stamp permission cannot add a stamp", async () => {
    await assert.rejects(
      () => asUser(CLERK, (tx) => tx`select public.staff_add_stamp(${cardToken}, 'clerk-stamp', true)`),
      /iago:not_authorized/,
    );
  });

  await t.test("repeating an idempotency key does not add a second stamp", async () => {
    const first = resultOf(
      await asUser(OWNER_A, (tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.staff_add_stamp(${cardToken}, 'stamp-idem-1', false) as result
        `,
      ),
    );
    const second = resultOf(
      await asUser(OWNER_A, (tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.staff_add_stamp(${cardToken}, 'stamp-idem-1', false) as result
        `,
      ),
    );
    assert.equal(Number(first.stamps_balance), 1);
    assert.equal(first.idempotent, false);
    assert.equal(Number(second.stamps_balance), 1);
    assert.equal(second.idempotent, true);
    assert.equal(second.transaction_id, first.transaction_id);
  });

  await t.test("a second stamp within the confirm window needs an explicit confirm", async () => {
    await assert.rejects(
      () => asUser(OWNER_A, (tx) => tx`select public.staff_add_stamp(${cardToken}, 'stamp-idem-2', false)`),
      /iago:duplicate_scan/,
    );
    const added = resultOf(
      await asUser(OWNER_A, (tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.staff_add_stamp(${cardToken}, 'stamp-idem-2', true) as result
        `,
      ),
    );
    assert.equal(Number(added.stamps_balance), 2);
    assert.equal(added.entitlement_granted, false);
    const completed = resultOf(
      await asUser(OWNER_A, (tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.staff_add_stamp(${cardToken}, 'stamp-idem-3', true) as result
        `,
      ),
    );
    assert.equal(Number(completed.stamps_balance), 0);
    assert.equal(completed.entitlement_granted, true);
  });

  let entitlementId = "";

  await t.test("completing a stamp card grants one reward and redeems it once", async () => {
    const lookup = await asUser(OWNER_A, (tx) =>
      tx<{ staff_lookup: { entitlements: { id: string; name: string }[] } }[]>`
        select public.staff_lookup(${cardToken}) as staff_lookup
      `,
    );
    const entitlements = lookup[0].staff_lookup.entitlements;
    assert.equal(entitlements.length, 1);
    assert.equal(entitlements[0].name, "Free sample");
    entitlementId = entitlements[0].id;
    const redeemed = resultOf(
      await asUser(OWNER_A, (tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.staff_redeem(${cardToken}, ${entitlementId}::uuid, null, 'redeem-stamp-1') as result
        `,
      ),
    );
    assert.equal(Number(redeemed.stamps_balance), 0);
    await assert.rejects(
      () =>
        asUser(OWNER_A, (tx) =>
          tx`select public.staff_redeem(${cardToken}, ${entitlementId}::uuid, null, 'redeem-stamp-2')`,
        ),
      /iago:reward_unavailable/,
    );
  });

  await t.test("points are calculated from the purchase amount inside the database", async () => {
    const pointsCustomer = await asAnon((tx) =>
      tx<{ enroll_customer: Enrollment }[]>`
        select public.enroll_customer(
          'salon-sur', 'Bea', 'Paz', 'bea@example.com', null, null,
          true, true, false, false, 'enroll-bea'
        ) as enroll_customer
      `,
    );
    const pointsToken = pointsCustomer[0].enroll_customer.public_token;
    await assert.rejects(
      () =>
        asUser(OWNER_B, (tx) =>
          tx`select public.staff_record_purchase(${pointsToken}, 4, 'purchase-low', null, true)`,
        ),
      /iago:below_minimum/,
    );
    const earned = resultOf(
      await asUser(OWNER_B, (tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.staff_record_purchase(${pointsToken}, 10.50, 'purchase-1', 'order-1', true) as result
        `,
      ),
    );
    assert.equal(Number(earned.points_balance), 21);
    const replay = resultOf(
      await asUser(OWNER_B, (tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.staff_record_purchase(${pointsToken}, 10.50, 'purchase-2', 'order-1', true) as result
        `,
      ),
    );
    assert.equal(replay.idempotent, true);
    assert.equal(Number(replay.points_balance), 21);
    const redeemed = resultOf(
      await asUser(OWNER_B, (tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.staff_redeem(${pointsToken}, null, ${catalogRewardId}::uuid, 'redeem-points-1') as result
        `,
      ),
    );
    assert.equal(Number(redeemed.points_balance), 0);
    await assert.rejects(
      () =>
        asUser(OWNER_B, (tx) =>
          tx`select public.staff_record_purchase(${pointsToken}, 10.50, 'purchase-3', 'order-2', false)`,
        ),
      /iago:duplicate_scan/,
    );
  });

  await t.test("a stamp code only works for its own business, then respects cooldown and single use", async () => {
    const staticCode = await asUser(OWNER_A, (tx) =>
      tx<{ create_stamp_code: StampCode }[]>`
        select public.create_stamp_code(${businessA}::uuid, ${stampProgramId}::uuid, 'Counter', 'static')
          as create_stamp_code
      `,
    );
    const code = staticCode[0].create_stamp_code.code;
    const pointsCustomer = await asUser(OWNER_B, (tx) =>
      tx<{ public_token: string }[]>`
        select public_token from public.loyalty_memberships
      `,
    );
    await assert.rejects(
      () =>
        asAnon((tx) =>
          tx`select public.collect_stamp(
            ${pointsCustomer[0].public_token}, ${code}, 'customer_nfc', 'cross-code', 'collect-cross'
          )`,
        ),
      /iago:stamp_code_invalid/,
    );

    const collected = resultOf(
      await asAnon((tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.collect_stamp(
            ${cardToken}, ${code}, 'customer_qr', 'collect-1', 'collect-ana'
          ) as result
        `,
      ),
    );
    assert.equal(Number(collected.stamps_balance), 1);
    await assert.rejects(
      () =>
        asAnon((tx) =>
          tx`select public.collect_stamp(
            ${cardToken}, ${code}, 'customer_qr', 'collect-2', 'collect-ana-2'
          )`,
        ),
      /iago:stamp_cooldown/,
    );

    const rotating = await asUser(OWNER_A, (tx) =>
      tx<{ create_stamp_code: StampCode }[]>`
        select public.create_stamp_code(${businessA}::uuid, ${stampProgramId}::uuid, 'Popup', 'rotating')
          as create_stamp_code
      `,
    );
    const rotatingCode = rotating[0].create_stamp_code.code;
    assert.equal(rotating[0].create_stamp_code.kind, "rotating");
    assert.ok(rotating[0].create_stamp_code.expires_at);
    const once = resultOf(
      await asAnon((tx) =>
        tx<{ result: LoyaltyResult }[]>`
          select public.collect_stamp(
            ${cardToken}, ${rotatingCode}, 'customer_nfc', 'collect-rot-1', 'collect-rot'
          ) as result
        `,
      ),
    );
    assert.equal(Number(once.stamps_balance), 2);
    await assert.rejects(
      () =>
        asAnon((tx) =>
          tx`select public.collect_stamp(
            ${cardToken}, ${rotatingCode}, 'customer_nfc', 'collect-rot-2', 'collect-rot-2'
          )`,
        ),
      /iago:stamp_code_used/,
    );

    const expired = await asUser(OWNER_A, (tx) =>
      tx<{ create_stamp_code: StampCode }[]>`
        select public.create_stamp_code(${businessA}::uuid, ${stampProgramId}::uuid, 'Old', 'rotating')
          as create_stamp_code
      `,
    );
    await admin`
      update public.stamp_codes
      set expires_at = now() - interval '1 minute'
      where code = ${expired[0].create_stamp_code.code}
    `;
    await assert.rejects(
      () =>
        asAnon((tx) =>
          tx`select public.collect_stamp(
            ${cardToken}, ${expired[0].create_stamp_code.code}, 'customer_qr', 'collect-expired', 'collect-expired'
          )`,
        ),
      /iago:stamp_code_expired/,
    );
  });

  await t.test("balances and the ledger cannot be edited outside the posting function", async () => {
    await assert.rejects(
      () => admin`update public.loyalty_memberships set points_balance = 999`,
      /iago:balance_locked/,
    );
    await assert.rejects(
      () => admin`delete from public.loyalty_transactions`,
      /iago:ledger_immutable/,
    );
  });

  await t.test("brand colors and the logo must be a hex color and an https URL", async () => {
    await asUser(OWNER_A, (tx) =>
      tx`select public.update_business_branding(
        ${businessA}::uuid, '#1F4D3A', '#C4A574', 'https://example.com/logo.png'
      )`,
    );
    const branded = await asUser(OWNER_A, (tx) =>
      tx<{ brand_color: string; logo_url: string }[]>`
        select brand_color, logo_url from public.businesses where id = ${businessA}
      `,
    );
    assert.equal(branded[0].brand_color, "#1F4D3A");
    assert.equal(branded[0].logo_url, "https://example.com/logo.png");
    await assert.rejects(
      () =>
        asUser(OWNER_A, (tx) =>
          tx`select public.update_business_branding(${businessA}::uuid, 'green', null, null)`,
        ),
      /iago:invalid_color/,
    );
    await assert.rejects(
      () =>
        asUser(OWNER_A, (tx) =>
          tx`select public.update_business_branding(${businessA}::uuid, null, null, 'http://example.com/logo.png')`,
        ),
      /iago:invalid_logo/,
    );
  });

  await t.test("a suspended business cannot enroll or collect stamps", async () => {
    await asUser(ADMIN, (tx) => tx`select public.set_business_status(${businessA}::uuid, 'suspended')`);
    await assert.rejects(
      () =>
        asAnon((tx) =>
          tx`select public.enroll_customer(
            'cafe-norte', 'Cia', 'Reyes', 'cia@example.com', null, null,
            true, false, false, false, 'enroll-cia'
          )`,
        ),
      /iago:business_suspended/,
    );
    await assert.rejects(
      () => asUser(OWNER_A, (tx) => tx`select public.staff_add_stamp(${cardToken}, 'stamp-while-suspended', true)`),
      /iago:business_suspended/,
    );
  });

  await t.test("the anonymous role cannot read customer rows directly", async () => {
    await assert.rejects(
      () => asAnon((tx) => tx`select id from public.customers`),
      /permission denied|42501/i,
    );
  });
});

test.after(async () => {
  await admin.end({ timeout: 1 });
  await app.end({ timeout: 1 });
});
