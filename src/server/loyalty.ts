import type { SupabaseClient } from "@supabase/supabase-js";
import type postgres from "postgres";
import { asLedgerSource, asLedgerType, asProgramType, asRewardType } from "@/domain/loyalty-labels";
import { getDataMode } from "@/lib/config";
import { withAnon, withUser } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BusinessBranding,
  EnrollmentProfile,
  EnrollmentResult,
  LedgerEntry,
  LoyaltyCounts,
  LoyaltyCustomer,
  LoyaltyProgram,
  LoyaltyReward,
  MembershipCard,
  StaffCustomer,
  StampCodeRecord,
  StampCodeResult,
  StampPreview,
} from "@/server/loyalty-types";

type Sql = postgres.TransactionSql;

async function call<T>(userId: string | null, local: (tx: Sql) => Promise<T>, remote: (client: SupabaseClient) => Promise<T>) {
  if (getDataMode() === "supabase") {
    return remote(await createSupabaseServerClient());
  }
  if (!userId) {
    return withAnon(local);
  }
  return withUser(userId, local);
}

async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new Error(error.message);
  }
  return data as T;
}

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return Number(value);
}

function asIso(value: string | Date | null) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function mapProfile(row: {
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string | null;
  brand_color_secondary: string | null;
  locale: string;
  currency: string;
  enrollment_open: boolean;
  program: EnrollmentProfile["program"] | null;
}): EnrollmentProfile {
  const program = row.program
    ? {
        ...row.program,
        type: asProgramType(row.program.type),
        stampsRequired: asNumber(row.program.stampsRequired),
        pointsPerCurrencyUnit: asNumber(row.program.pointsPerCurrencyUnit),
        minPurchaseAmount: Number(row.program.minPurchaseAmount ?? 0),
        currency: String(row.program.currency).trim(),
      }
    : null;
  return {
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    brandColor: row.brand_color,
    brandColorSecondary: row.brand_color_secondary,
    locale: row.locale,
    currency: String(row.currency).trim(),
    enrollmentOpen: row.enrollment_open,
    program,
  };
}

function snakeProfile(row: Record<string, unknown>): EnrollmentProfile {
  const program = row.program as Record<string, unknown> | null;
  return mapProfile({
    name: String(row.name),
    slug: String(row.slug),
    logo_url: (row.logo_url as string | null) ?? null,
    brand_color: (row.brand_color as string | null) ?? null,
    brand_color_secondary: (row.brand_color_secondary as string | null) ?? null,
    locale: String(row.locale),
    currency: String(row.currency),
    enrollment_open: Boolean(row.enrollment_open),
    program: program
      ? {
          name: String(program.name),
          type: asProgramType(String(program.type)),
          stampsRequired: asNumber(program.stamps_required as number | string | null),
          pointsPerCurrencyUnit: asNumber(program.points_per_currency_unit as number | string | null),
          minPurchaseAmount: Number(program.min_purchase_amount ?? 0),
          terms: (program.terms as string | null) ?? null,
          currency: String(program.currency),
        }
      : null,
  });
}

export async function getEnrollmentProfile(slug: string): Promise<EnrollmentProfile | null> {
  const row = await call(
    null,
    async (tx) => {
      const rows = await tx<{ get_enrollment_profile: Record<string, unknown> | null }[]>`
        select public.get_enrollment_profile(${slug}) as get_enrollment_profile
      `;
      return rows[0]?.get_enrollment_profile ?? null;
    },
    (client) => rpc<Record<string, unknown> | null>(client, "get_enrollment_profile", { p_slug: slug }),
  );
  return row ? snakeProfile(row) : null;
}

export async function enrollCustomer(input: {
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthday: string | null;
  accept: boolean;
  emailConsent: boolean;
  whatsappConsent: boolean;
  smsConsent: boolean;
  rateBucket: string;
}): Promise<EnrollmentResult> {
  const args = {
    p_slug: input.slug,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_phone: input.phone,
    p_birthday: input.birthday,
    p_accept: input.accept,
    p_email_consent: input.emailConsent,
    p_whatsapp_consent: input.whatsappConsent,
    p_sms_consent: input.smsConsent,
    p_rate_bucket: input.rateBucket,
  };
  const row = await call(
    null,
    async (tx) => {
      const rows = await tx<{ enroll_customer: { public_token: string; membership_number: string } }[]>`
        select public.enroll_customer(
          ${input.slug},
          ${input.firstName},
          ${input.lastName},
          ${input.email},
          ${input.phone},
          ${input.birthday}::date,
          ${input.accept},
          ${input.emailConsent},
          ${input.whatsappConsent},
          ${input.smsConsent},
          ${input.rateBucket}
        ) as enroll_customer
      `;
      return rows[0]?.enroll_customer;
    },
    (client) => rpc<{ public_token: string; membership_number: string }>(client, "enroll_customer", args),
  );
  if (!row?.public_token) {
    throw new Error("iago:not_found");
  }
  return { publicToken: row.public_token, membershipNumber: row.membership_number };
}

function mapCard(row: Record<string, unknown>): MembershipCard {
  const rewards = Array.isArray(row.rewards) ? row.rewards.filter((item): item is string => typeof item === "string") : [];
  return {
    businessName: String(row.business_name),
    logoUrl: (row.logo_url as string | null) ?? null,
    brandColor: (row.brand_color as string | null) ?? null,
    brandColorSecondary: (row.brand_color_secondary as string | null) ?? null,
    locale: String(row.locale),
    currency: String(row.currency).trim(),
    membershipNumber: String(row.membership_number),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    programName: String(row.program_name),
    programType: asProgramType(String(row.program_type)),
    stampsBalance: Number(row.stamps_balance),
    stampsRequired: asNumber(row.stamps_required as number | string | null),
    pointsBalance: Number(row.points_balance),
    rewards,
  };
}

export async function getMembershipCard(token: string, rateBucket: string): Promise<MembershipCard | null> {
  const row = await call(
    null,
    async (tx) => {
      const rows = await tx<{ get_membership_card: Record<string, unknown> | null }[]>`
        select public.get_membership_card(${token}, ${rateBucket}) as get_membership_card
      `;
      return rows[0]?.get_membership_card ?? null;
    },
    (client) => rpc<Record<string, unknown> | null>(client, "get_membership_card", { p_token: token, p_rate_bucket: rateBucket }),
  );
  return row ? mapCard(row) : null;
}

export async function getStampPreview(code: string): Promise<StampPreview | null> {
  const row = await call(
    null,
    async (tx) => {
      const rows = await tx<{ get_stamp_preview: Record<string, unknown> | null }[]>`
        select public.get_stamp_preview(${code}) as get_stamp_preview
      `;
      return rows[0]?.get_stamp_preview ?? null;
    },
    (client) => rpc<Record<string, unknown> | null>(client, "get_stamp_preview", { p_code: code }),
  );
  if (!row) {
    return null;
  }
  const kind = row.kind === "rotating" ? "rotating" : "static";
  return {
    businessName: String(row.business_name),
    logoUrl: (row.logo_url as string | null) ?? null,
    brandColor: (row.brand_color as string | null) ?? null,
    brandColorSecondary: (row.brand_color_secondary as string | null) ?? null,
    locale: String(row.locale),
    label: (row.label as string | null) ?? null,
    kind,
    usable: Boolean(row.usable),
  };
}

export async function collectStamp(input: {
  cardToken: string;
  code: string;
  source: "customer_qr" | "customer_nfc";
  idempotencyKey: string;
  rateBucket: string;
}) {
  return call(
    null,
    (tx) => tx`
      select public.collect_stamp(
        ${input.cardToken},
        ${input.code},
        ${input.source},
        ${input.idempotencyKey},
        ${input.rateBucket}
      )
    `,
    (client) =>
      rpc(client, "collect_stamp", {
        p_card_token: input.cardToken,
        p_code: input.code,
        p_source: input.source,
        p_idempotency_key: input.idempotencyKey,
        p_rate_bucket: input.rateBucket,
      }),
  );
}

function mapProgram(row: {
  id: string;
  name: string;
  program_type: string;
  is_primary: boolean;
  stamps_required: number | null;
  stamp_cooldown_seconds: number;
  points_per_currency_unit: number | string | null;
  min_purchase_amount: number | string;
  currency_code: string;
  terms: string | null;
  stamp_reward_id: string | null;
}): LoyaltyProgram {
  return {
    id: row.id,
    name: row.name,
    programType: asProgramType(row.program_type),
    isPrimary: row.is_primary,
    stampsRequired: asNumber(row.stamps_required),
    cooldownSeconds: Number(row.stamp_cooldown_seconds),
    pointsPerCurrencyUnit: asNumber(row.points_per_currency_unit),
    minPurchaseAmount: Number(row.min_purchase_amount),
    currency: row.currency_code.trim(),
    terms: row.terms,
    stampRewardId: row.stamp_reward_id,
  };
}

export async function listPrograms(userId: string, businessId: string): Promise<LoyaltyProgram[]> {
  const rows = await call(
    userId,
    async (tx) => {
      const result = await tx<Parameters<typeof mapProgram>[0][]>`
        select id, name, program_type, is_primary, stamps_required, stamp_cooldown_seconds,
               points_per_currency_unit, min_purchase_amount, currency_code, terms, stamp_reward_id
        from public.loyalty_programs
        where business_id = ${businessId}
          and status = 'active'
        order by is_primary desc, created_at
      `;
      return [...result];
    },
    async (client) => {
      const { data, error } = await client
        .from("loyalty_programs")
        .select("id, name, program_type, is_primary, stamps_required, stamp_cooldown_seconds, points_per_currency_unit, min_purchase_amount, currency_code, terms, stamp_reward_id")
        .eq("business_id", businessId)
        .eq("status", "active")
        .order("is_primary", { ascending: false });
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as Parameters<typeof mapProgram>[0][];
    },
  );
  return rows.map((row) => mapProgram(row));
}

export async function createProgram(
  userId: string,
  input: {
    businessId: string;
    name: string;
    programType: string;
    stampsRequired: number | null;
    pointsPerCurrencyUnit: number | null;
    minPurchase: number;
    currency: string;
    cooldown: number;
    isPrimary: boolean;
    terms: string | null;
  },
) {
  const id = await call(
    userId,
    async (tx) => {
      const rows = await tx<{ create_loyalty_program: string }[]>`
        select public.create_loyalty_program(
          ${input.businessId}::uuid,
          ${input.name},
          ${input.programType},
          ${input.stampsRequired},
          ${input.pointsPerCurrencyUnit},
          ${input.minPurchase},
          ${input.currency},
          ${input.cooldown},
          ${input.isPrimary},
          ${input.terms}
        ) as create_loyalty_program
      `;
      return rows[0]?.create_loyalty_program;
    },
    (client) =>
      rpc<string>(client, "create_loyalty_program", {
        p_business_id: input.businessId,
        p_name: input.name,
        p_program_type: input.programType,
        p_stamps_required: input.stampsRequired,
        p_points_per_currency_unit: input.pointsPerCurrencyUnit,
        p_min_purchase: input.minPurchase,
        p_currency: input.currency,
        p_cooldown: input.cooldown,
        p_is_primary: input.isPrimary,
        p_terms: input.terms,
      }),
  );
  if (!id) {
    throw new Error("iago:not_found");
  }
  return id;
}

function mapReward(row: {
  id: string;
  program_id: string;
  name: string;
  description: string | null;
  reward_type: string;
  points_cost: number | null;
  inventory_limit: number | null;
  redeemed_count: number;
  per_customer_limit: number | null;
  active: boolean;
}): LoyaltyReward {
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    description: row.description,
    rewardType: asRewardType(row.reward_type),
    pointsCost: asNumber(row.points_cost),
    inventoryLimit: asNumber(row.inventory_limit),
    redeemedCount: Number(row.redeemed_count),
    perCustomerLimit: asNumber(row.per_customer_limit),
    active: row.active,
  };
}

export async function listRewards(userId: string, businessId: string): Promise<LoyaltyReward[]> {
  const rows = await call(
    userId,
    async (tx) => {
      const result = await tx<Parameters<typeof mapReward>[0][]>`
        select id, program_id, name, description, reward_type, points_cost, inventory_limit,
               redeemed_count, per_customer_limit, active
        from public.rewards
        where business_id = ${businessId}
        order by created_at desc
      `;
      return [...result];
    },
    async (client) => {
      const { data, error } = await client
        .from("rewards")
        .select("id, program_id, name, description, reward_type, points_cost, inventory_limit, redeemed_count, per_customer_limit, active")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as Parameters<typeof mapReward>[0][];
    },
  );
  return rows.map((row) => mapReward(row));
}

export async function createReward(
  userId: string,
  input: {
    programId: string;
    name: string;
    description: string | null;
    rewardType: string;
    pointsCost: number | null;
    discountPercent: number | null;
    discountAmount: number | null;
    inventory: number | null;
    perCustomer: number | null;
  },
) {
  await call(
    userId,
    (tx) => tx`
      select public.create_reward(
        ${input.programId}::uuid,
        ${input.name},
        ${input.description},
        ${input.rewardType},
        ${input.pointsCost},
        ${input.discountPercent},
        ${input.discountAmount},
        ${input.inventory},
        ${input.perCustomer}
      )
    `,
    (client) =>
      rpc(client, "create_reward", {
        p_program_id: input.programId,
        p_name: input.name,
        p_description: input.description,
        p_reward_type: input.rewardType,
        p_points_cost: input.pointsCost,
        p_discount_percent: input.discountPercent,
        p_discount_amount: input.discountAmount,
        p_inventory: input.inventory,
        p_per_customer: input.perCustomer,
      }),
  );
}

export async function setStampReward(userId: string, programId: string, rewardId: string) {
  await call(
    userId,
    (tx) => tx`select public.set_stamp_reward(${programId}::uuid, ${rewardId}::uuid)`,
    (client) => rpc(client, "set_stamp_reward", { p_program_id: programId, p_reward_id: rewardId }),
  );
}

export async function updateBranding(
  userId: string,
  businessId: string,
  brandColor: string | null,
  brandColorSecondary: string | null,
  logoUrl: string | null,
) {
  await call(
    userId,
    (tx) => tx`
      select public.update_business_branding(
        ${businessId}::uuid,
        ${brandColor},
        ${brandColorSecondary},
        ${logoUrl}
      )
    `,
    (client) =>
      rpc(client, "update_business_branding", {
        p_business_id: businessId,
        p_brand_color: brandColor,
        p_brand_color_secondary: brandColorSecondary,
        p_logo_url: logoUrl,
      }),
  );
}

export async function getBranding(userId: string, businessId: string): Promise<BusinessBranding | null> {
  const rows = await call(
    userId,
    (tx) => tx<{ brand_color: string | null; brand_color_secondary: string | null; logo_url: string | null }[]>`
      select brand_color, brand_color_secondary, logo_url
      from public.businesses
      where id = ${businessId}
    `,
    async (client) => {
      const { data, error } = await client
        .from("businesses")
        .select("brand_color, brand_color_secondary, logo_url")
        .eq("id", businessId)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      return data ? [data] : [];
    },
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    brandColor: row.brand_color,
    brandColorSecondary: row.brand_color_secondary,
    logoUrl: row.logo_url,
  };
}

export async function listCustomers(userId: string, businessId: string): Promise<LoyaltyCustomer[]> {
  const rows = await call(
    userId,
    async (tx) => {
      const result = await tx<LoyaltyCustomerRow[]>`
        select c.id, c.first_name, c.last_name, c.email::text as email, c.phone, c.created_at,
               m.membership_number, m.points_balance, m.stamps_balance, m.public_token
        from public.customers c
        join public.loyalty_memberships m on m.customer_id = c.id
        where c.business_id = ${businessId}
        order by c.created_at desc
        limit 200
      `;
      return [...result];
    },
    async (client) => {
      const { data, error } = await client
        .from("customers")
        .select("id, first_name, last_name, email, phone, created_at, loyalty_memberships(membership_number, points_balance, stamps_balance, public_token)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).flatMap((row) => {
        const memberships = Array.isArray(row.loyalty_memberships) ? row.loyalty_memberships : row.loyalty_memberships ? [row.loyalty_memberships] : [];
        return memberships.map((membership) => ({
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          created_at: row.created_at,
          membership_number: membership.membership_number,
          points_balance: membership.points_balance,
          stamps_balance: membership.stamps_balance,
          public_token: membership.public_token,
        }));
      });
    },
  );
  return rows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    createdAt: asIso(row.created_at) ?? new Date(0).toISOString(),
    membershipNumber: row.membership_number,
    pointsBalance: Number(row.points_balance),
    stampsBalance: Number(row.stamps_balance),
    publicToken: row.public_token,
  }));
}

type LoyaltyCustomerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  created_at: string | Date;
  membership_number: string;
  points_balance: number;
  stamps_balance: number;
  public_token: string;
};

export async function listTransactions(userId: string, businessId: string): Promise<LedgerEntry[]> {
  const rows = await call(
    userId,
    async (tx) => {
      const result = await tx<LedgerRow[]>`
        select t.id, t.created_at, t.type, t.points_delta, t.stamps_delta, t.amount, t.currency_code,
               t.source, t.reason, t.external_reference,
               (
                 select m.membership_number from public.loyalty_memberships m where m.id = t.membership_id
               ) as membership_number,
               (
                 select c.first_name || ' ' || c.last_name
                 from public.loyalty_memberships m
                 join public.customers c on c.id = m.customer_id
                 where m.id = t.membership_id
               ) as customer_name
        from public.loyalty_transactions t
        where t.business_id = ${businessId}
        order by t.created_at desc
        limit 100
      `;
      return [...result];
    },
    async (client) => {
      const { data, error } = await client
        .from("loyalty_transactions")
        .select("id, created_at, type, points_delta, stamps_delta, amount, currency_code, source, reason, external_reference, loyalty_memberships(membership_number, customers(first_name, last_name))")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row) => {
        const membership = Array.isArray(row.loyalty_memberships) ? row.loyalty_memberships[0] : row.loyalty_memberships;
        const customer = membership && "customers" in membership
          ? Array.isArray(membership.customers) ? membership.customers[0] : membership.customers
          : null;
        return {
          id: row.id,
          created_at: row.created_at,
          type: row.type,
          points_delta: row.points_delta,
          stamps_delta: row.stamps_delta,
          amount: row.amount,
          currency_code: row.currency_code,
          source: row.source,
          reason: row.reason,
          external_reference: row.external_reference,
          membership_number: membership?.membership_number ?? null,
          customer_name: customer ? `${customer.first_name} ${customer.last_name}` : null,
        } satisfies LedgerRow;
      });
    },
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: asIso(row.created_at) ?? new Date(0).toISOString(),
    type: asLedgerType(row.type),
    pointsDelta: Number(row.points_delta),
    stampsDelta: Number(row.stamps_delta),
    amount: asNumber(row.amount),
    currency: row.currency_code?.trim() ?? null,
    source: asLedgerSource(row.source),
    reason: row.reason,
    externalReference: row.external_reference,
    membershipNumber: row.membership_number,
    customerName: row.customer_name,
  }));
}

type LedgerRow = {
  id: string;
  created_at: string | Date;
  type: string;
  points_delta: number;
  stamps_delta: number;
  amount: number | string | null;
  currency_code: string | null;
  source: string;
  reason: string | null;
  external_reference: string | null;
  membership_number: string | null;
  customer_name: string | null;
};

export async function loyaltyCounts(userId: string, businessId: string): Promise<LoyaltyCounts> {
  const rows = await call(
    userId,
    (tx) => tx<{ customers: number; stamps_issued: number; points_issued: number; redemptions: number }[]>`
      select
        (select count(*) from public.customers where business_id = ${businessId})::int as customers,
        (select coalesce(sum(stamps_delta), 0) from public.loyalty_transactions where business_id = ${businessId} and stamps_delta > 0)::int as stamps_issued,
        (select coalesce(sum(points_delta), 0) from public.loyalty_transactions where business_id = ${businessId} and type = 'points_earned')::int as points_issued,
        (select count(*) from public.loyalty_transactions where business_id = ${businessId} and type = 'reward_redeemed')::int as redemptions
    `,
    async (client) => {
      const [customers, stamps, points, redemptions] = await Promise.all([
        client.from("customers").select("id", { count: "exact", head: true }).eq("business_id", businessId),
        client.from("loyalty_transactions").select("stamps_delta").eq("business_id", businessId).gt("stamps_delta", 0),
        client.from("loyalty_transactions").select("points_delta").eq("business_id", businessId).eq("type", "points_earned"),
        client.from("loyalty_transactions").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("type", "reward_redeemed"),
      ]);
      for (const result of [customers, stamps, points, redemptions]) {
        if (result.error) {
          throw new Error(result.error.message);
        }
      }
      return [
        {
          customers: customers.count ?? 0,
          stamps_issued: (stamps.data ?? []).reduce((sum, row) => sum + Number(row.stamps_delta), 0),
          points_issued: (points.data ?? []).reduce((sum, row) => sum + Number(row.points_delta), 0),
          redemptions: redemptions.count ?? 0,
        },
      ];
    },
  );
  const row = rows[0];
  return {
    customers: Number(row?.customers ?? 0),
    stampsIssued: Number(row?.stamps_issued ?? 0),
    pointsIssued: Number(row?.points_issued ?? 0),
    redemptions: Number(row?.redemptions ?? 0),
  };
}

export async function listStampCodes(userId: string, businessId: string): Promise<StampCodeRecord[]> {
  const rows = await call(
    userId,
    async (tx) => {
      const result = await tx<StampCodeRow[]>`
        select code, kind, label, expires_at, used_at, created_at, program_id
        from public.stamp_codes
        where business_id = ${businessId}
        order by created_at desc
        limit 30
      `;
      return [...result];
    },
    async (client) => {
      const { data, error } = await client
        .from("stamp_codes")
        .select("code, kind, label, expires_at, used_at, created_at, program_id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as StampCodeRow[];
    },
  );
  return rows.map((row) => ({
    code: row.code,
    kind: row.kind === "rotating" ? "rotating" : "static",
    label: row.label,
    expiresAt: asIso(row.expires_at),
    usedAt: asIso(row.used_at),
    createdAt: asIso(row.created_at) ?? new Date(0).toISOString(),
    programId: row.program_id,
  }));
}

type StampCodeRow = {
  code: string;
  kind: string;
  label: string | null;
  expires_at: string | Date | null;
  used_at: string | Date | null;
  created_at: string | Date;
  program_id: string;
};

export async function createStampCode(
  userId: string,
  businessId: string,
  programId: string,
  label: string,
  kind: string,
): Promise<StampCodeResult> {
  const row = await call(
    userId,
    async (tx) => {
      const rows = await tx<{ create_stamp_code: { code: string; kind: string; expires_at: string | null; label: string | null } }[]>`
        select public.create_stamp_code(
          ${businessId}::uuid,
          ${programId}::uuid,
          ${label},
          ${kind}
        ) as create_stamp_code
      `;
      return rows[0]?.create_stamp_code;
    },
    (client) =>
      rpc<{ code: string; kind: string; expires_at: string | null; label: string | null }>(client, "create_stamp_code", {
        p_business_id: businessId,
        p_program_id: programId,
        p_label: label,
        p_kind: kind,
      }),
  );
  if (!row?.code) {
    throw new Error("iago:not_found");
  }
  return {
    code: row.code,
    kind: row.kind === "rotating" ? "rotating" : "static",
    expiresAt: row.expires_at,
    label: row.label,
  };
}

export async function staffLookup(userId: string, token: string): Promise<StaffCustomer> {
  const row = await call(
    userId,
    async (tx) => {
      const rows = await tx<{ staff_lookup: Record<string, unknown> }[]>`
        select public.staff_lookup(${token}) as staff_lookup
      `;
      return rows[0]?.staff_lookup;
    },
    (client) => rpc<Record<string, unknown>>(client, "staff_lookup", { p_token: token }),
  );
  if (!row) {
    throw new Error("iago:not_found");
  }
  const entitlements = Array.isArray(row.entitlements) ? row.entitlements : [];
  const rewards = Array.isArray(row.rewards) ? row.rewards : [];
  return {
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    membershipNumber: String(row.membership_number),
    stampsBalance: Number(row.stamps_balance),
    pointsBalance: Number(row.points_balance),
    stampsRequired: asNumber(row.stamps_required as number | string | null),
    programType: asProgramType(String(row.program_type)),
    programName: String(row.program_name),
    currency: String(row.currency).trim(),
    entitlements: entitlements.map((item) => {
      const record = item as { id: string; name: string };
      return { id: record.id, name: record.name };
    }),
    rewards: rewards.map((item) => {
      const record = item as { id: string; name: string; points_cost: number };
      return { id: record.id, name: record.name, pointsCost: Number(record.points_cost) };
    }),
  };
}

export async function staffAddStamp(userId: string, token: string, idempotencyKey: string, confirm: boolean) {
  await call(
    userId,
    (tx) => tx`select public.staff_add_stamp(${token}, ${idempotencyKey}, ${confirm})`,
    (client) =>
      rpc(client, "staff_add_stamp", {
        p_token: token,
        p_idempotency_key: idempotencyKey,
        p_confirm: confirm,
      }),
  );
}

export async function staffRecordPurchase(
  userId: string,
  token: string,
  amount: number,
  idempotencyKey: string,
  externalReference: string | null,
  confirm: boolean,
) {
  await call(
    userId,
    (tx) => tx`
      select public.staff_record_purchase(
        ${token},
        ${amount},
        ${idempotencyKey},
        ${externalReference},
        ${confirm}
      )
    `,
    (client) =>
      rpc(client, "staff_record_purchase", {
        p_token: token,
        p_amount: amount,
        p_idempotency_key: idempotencyKey,
        p_external_reference: externalReference,
        p_confirm: confirm,
      }),
  );
}

export async function staffRedeem(
  userId: string,
  token: string,
  entitlementId: string | null,
  rewardId: string | null,
  idempotencyKey: string,
) {
  await call(
    userId,
    (tx) => tx`
      select public.staff_redeem(
        ${token},
        ${entitlementId}::uuid,
        ${rewardId}::uuid,
        ${idempotencyKey}
      )
    `,
    (client) =>
      rpc(client, "staff_redeem", {
        p_token: token,
        p_entitlement_id: entitlementId,
        p_reward_id: rewardId,
        p_idempotency_key: idempotencyKey,
      }),
  );
}
