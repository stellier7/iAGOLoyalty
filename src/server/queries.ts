import type { SupabaseClient } from "@supabase/supabase-js";
import type postgres from "postgres";
import { getDataMode } from "@/lib/config";
import { getAppDb, withUser } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BusinessRecord,
  BusinessStatus,
  InvitationPreview,
  InvitationRecord,
  MembershipRecord,
  MemberRole,
  MemberStatus,
  PlatformCounts,
  PlatformRole,
  Profile,
  SubscriptionRecord,
  TeamMember,
} from "@/server/types";
import type { PermissionMap } from "@/domain/permissions";

type Sql = postgres.TransactionSql;

function asRole(value: string): MemberRole {
  if (value === "owner" || value === "admin" || value === "employee") {
    return value;
  }
  throw new Error("iago:invalid_role");
}

function asStatus(value: string): BusinessStatus {
  if (value === "active" || value === "suspended" || value === "pending") {
    return value;
  }
  throw new Error("iago:invalid_status");
}

function asMemberStatus(value: string): MemberStatus {
  if (value === "active" || value === "invited" || value === "revoked") {
    return value;
  }
  throw new Error("iago:invalid_status");
}

function asPermissions(value: unknown): PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as PermissionMap;
}

function mapBusiness(row: {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  default_currency: string;
  locale: string;
  contact_email: string | null;
  created_at: string | Date;
}): BusinessRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: asStatus(row.status),
    timezone: row.timezone,
    currency: row.default_currency.trim(),
    locale: row.locale,
    contactEmail: row.contact_email,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function readAsUser<T>(userId: string, local: (tx: Sql) => Promise<T>, remote: (client: SupabaseClient) => Promise<T>) {
  if (getDataMode() === "supabase") {
    return remote(await createSupabaseServerClient());
  }
  return withUser(userId, local);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const rows = await readAsUser(
    userId,
    (tx) => tx<ProfileRow[]>`
      select id, full_name, email::text as email, platform_role
      from public.profiles
      where id = ${userId}
    `,
    async (client) => {
      const { data, error } = await client
        .from("profiles")
        .select("id, full_name, email, platform_role")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      return data ? [data as ProfileRow] : [];
    },
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  const platformRole: PlatformRole = row.platform_role === "super_admin" ? "super_admin" : null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    platformRole,
  };
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  platform_role: string | null;
};

export async function listMemberships(userId: string): Promise<MembershipRecord[]> {
  const rows = await readAsUser(
    userId,
    (tx) => tx<MembershipRow[]>`
      select
        m.business_id,
        m.user_id,
        m.role,
        m.status,
        m.permissions,
        b.name as business_name,
        b.status as business_status
      from public.business_members m
      join public.businesses b on b.id = m.business_id
      where m.user_id = ${userId}
        and m.status = 'active'
      order by b.name
    `,
    async (client) => {
      const { data, error } = await client
        .from("business_members")
        .select("business_id, user_id, role, status, permissions, businesses(name, status)")
        .eq("user_id", userId)
        .eq("status", "active");
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row) => {
        const business = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
        return {
          business_id: row.business_id,
          user_id: row.user_id,
          role: row.role,
          status: row.status,
          permissions: row.permissions,
          business_name: business?.name ?? "Business",
          business_status: business?.status ?? "active",
        } satisfies MembershipRow;
      });
    },
  );

  return rows.map((row) => ({
    businessId: row.business_id,
    userId: row.user_id,
    role: asRole(row.role),
    status: asMemberStatus(row.status),
    permissions: asPermissions(row.permissions),
    businessName: row.business_name,
    businessStatus: asStatus(row.business_status),
  }));
}

type MembershipRow = {
  business_id: string;
  user_id: string;
  role: string;
  status: string;
  permissions: unknown;
  business_name: string;
  business_status: string;
};

type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  default_currency: string;
  locale: string;
  contact_email: string | null;
  created_at: string | Date;
};

export async function listBusinesses(userId: string): Promise<BusinessRecord[]> {
  const rows = await readAsUser<BusinessRow[]>(
    userId,
    async (tx) => {
      const result = await tx<BusinessRow[]>`
        select id, name, slug, status, timezone, default_currency, locale, contact_email::text, created_at
        from public.businesses
        order by created_at desc
      `;
      return [...result];
    },
    async (client) => {
      const { data, error } = await client
        .from("businesses")
        .select("id, name, slug, status, timezone, default_currency, locale, contact_email, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as BusinessRow[];
    },
  );
  return rows.map((row) => mapBusiness(row));
}

export async function getBusiness(userId: string, businessId: string): Promise<BusinessRecord | null> {
  const businesses = await listBusinesses(userId);
  return businesses.find((business) => business.id === businessId) ?? null;
}

export async function getSubscription(userId: string, businessId: string): Promise<SubscriptionRecord | null> {
  const rows = await readAsUser(
    userId,
    (tx) => tx<{ plan_code: string; status: string }[]>`
      select plan_code, status
      from public.subscriptions
      where business_id = ${businessId}
    `,
    async (client) => {
      const { data, error } = await client
        .from("subscriptions")
        .select("plan_code, status")
        .eq("business_id", businessId)
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
  return { planCode: row.plan_code, status: row.status };
}

export async function listTeam(userId: string, businessId: string): Promise<TeamMember[]> {
  const rows = await readAsUser(
    userId,
    (tx) => tx<TeamRow[]>`
      select m.user_id, m.role, m.status, m.permissions, p.full_name, p.email::text as email
      from public.business_members m
      join public.profiles p on p.id = m.user_id
      where m.business_id = ${businessId}
      order by m.created_at
    `,
    async (client) => {
      const { data, error } = await client
        .from("business_members")
        .select("user_id, role, status, permissions, profiles(full_name, email)")
        .eq("business_id", businessId);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          user_id: row.user_id,
          role: row.role,
          status: row.status,
          permissions: row.permissions,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
        } satisfies TeamRow;
      });
    },
  );

  return rows.map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    role: asRole(row.role),
    status: asMemberStatus(row.status),
    permissions: asPermissions(row.permissions),
  }));
}

type TeamRow = {
  user_id: string;
  role: string;
  status: string;
  permissions: unknown;
  full_name: string | null;
  email: string | null;
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  expires_at: string | Date;
  accepted_at: string | Date | null;
};

export async function listInvitations(userId: string, businessId: string): Promise<InvitationRecord[]> {
  const rows = await readAsUser<InvitationRow[]>(
    userId,
    async (tx) => {
      const result = await tx<InvitationRow[]>`
        select id, email, role, expires_at, accepted_at
        from public.list_invitations(${businessId}::uuid)
      `;
      return [...result];
    },
    async (client) => {
      const { data, error } = await client.rpc("list_invitations", { p_business_id: businessId });
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as InvitationRow[];
    },
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: asRole(row.role),
    expiresAt: new Date(row.expires_at).toISOString(),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
  }));
}

export async function platformCounts(userId: string): Promise<PlatformCounts> {
  const rows = await readAsUser(
    userId,
    (tx) => tx<{ businesses: number; active_members: number; suspended_businesses: number }[]>`
      select
        (select count(*)::int from public.businesses) as businesses,
        (select count(*)::int from public.business_members where status = 'active') as active_members,
        (select count(*)::int from public.businesses where status = 'suspended') as suspended_businesses
    `,
    async (client) => {
      const [businesses, suspended, members] = await Promise.all([
        client.from("businesses").select("id", { count: "exact", head: true }),
        client.from("businesses").select("id", { count: "exact", head: true }).eq("status", "suspended"),
        client.from("business_members").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      if (businesses.error || suspended.error || members.error) {
        throw new Error(businesses.error?.message ?? suspended.error?.message ?? members.error?.message);
      }
      return [
        {
          businesses: businesses.count ?? 0,
          suspended_businesses: suspended.count ?? 0,
          active_members: members.count ?? 0,
        },
      ];
    },
  );
  const row = rows[0];
  return {
    businesses: row?.businesses ?? 0,
    activeMembers: row?.active_members ?? 0,
    suspendedBusinesses: row?.suspended_businesses ?? 0,
  };
}

export async function listPlatformSettings(userId: string): Promise<Record<string, string>> {
  const rows = await readAsUser(
    userId,
    (tx) => tx<{ key: string; value: unknown }[]>`
      select key, value from public.platform_settings order by key
    `,
    async (client) => {
      const { data, error } = await client.from("platform_settings").select("key, value").order("key");
      if (error) {
        throw new Error(error.message);
      }
      return data ?? [];
    },
  );
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = typeof row.value === "string" ? row.value : "";
  }
  return settings;
}

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const raw = getDataMode() === "supabase"
    ? await previewWithSupabase(token)
    : await previewWithLocal(token);

  if (!raw || raw.state !== "pending") {
    const state = raw?.state === "used" || raw?.state === "expired" ? raw.state : "invalid";
    return { state };
  }

  return {
    state: "pending",
    businessName: String(raw.business_name ?? "Business"),
    email: String(raw.email ?? ""),
    role: asRole(String(raw.role ?? "")),
    expiresAt: new Date(String(raw.expires_at)).toISOString(),
  };
}

async function previewWithSupabase(token: string) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("preview_invitation", { p_token: token });
  if (error) {
    throw new Error(error.message);
  }
  return data as { state?: string; business_name?: string; email?: string; role?: string; expires_at?: string } | null;
}

async function previewWithLocal(token: string) {
  const rows = await getAppDb().begin(async (tx) => {
    await tx.unsafe("set local role anon");
    return tx<{ preview_invitation: { state?: string; business_name?: string; email?: string; role?: string; expires_at?: string } }[]>`
      select public.preview_invitation(${token}) as preview_invitation
    `;
  });
  return rows[0]?.preview_invitation ?? null;
}
