import type { SupabaseClient } from "@supabase/supabase-js";
import type postgres from "postgres";
import type { PermissionMap } from "@/domain/permissions";
import { getDataMode } from "@/lib/config";
import { withUser } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Sql = postgres.TransactionSql;

async function run(
  userId: string,
  local: (tx: Sql) => Promise<unknown>,
  remote: (client: SupabaseClient) => PromiseLike<{ error: { message: string } | null }>,
) {
  if (getDataMode() === "supabase") {
    const result = await remote(await createSupabaseServerClient());
    if (result.error) {
      throw new Error(result.error.message);
    }
    return;
  }
  await withUser(userId, local);
}

export async function createBusiness(
  userId: string,
  input: {
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    locale: string;
    contactEmail: string | null;
    ownerEmail: string;
  },
): Promise<{ businessId: string; invitationToken: string | null }> {
  if (getDataMode() === "supabase") {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("create_business", {
      p_name: input.name,
      p_slug: input.slug,
      p_timezone: input.timezone,
      p_currency: input.currency,
      p_locale: input.locale,
      p_contact_email: input.contactEmail,
      p_owner_email: input.ownerEmail,
    });
    if (error) {
      throw new Error(error.message);
    }
    const result = data as { business_id: string; invitation_token: string | null };
    return { businessId: result.business_id, invitationToken: result.invitation_token };
  }

  const rows = await withUser(userId, (tx) =>
    tx<{ create_business: { business_id: string; invitation_token: string | null } }[]>`
      select public.create_business(
        ${input.name},
        ${input.slug},
        ${input.timezone},
        ${input.currency},
        ${input.locale},
        ${input.contactEmail},
        ${input.ownerEmail}
      ) as create_business
    `,
  );
  const result = rows[0]?.create_business;
  if (!result?.business_id) {
    throw new Error("iago:not_found");
  }
  return { businessId: result.business_id, invitationToken: result.invitation_token };
}

export async function createInvitation(
  userId: string,
  businessId: string,
  email: string,
  role: string,
  permissions: PermissionMap,
): Promise<string> {
  if (getDataMode() === "supabase") {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("create_invitation", {
      p_business_id: businessId,
      p_email: email,
      p_role: role,
      p_permissions: permissions,
    });
    if (error) {
      throw new Error(error.message);
    }
    return String(data);
  }

  const rows = await withUser(userId, (tx) =>
    tx<{ create_invitation: string }[]>`
      select public.create_invitation(
        ${businessId}::uuid,
        ${email},
        ${role},
        ${tx.json(permissions)}
      ) as create_invitation
    `,
  );
  const token = rows[0]?.create_invitation;
  if (!token) {
    throw new Error("iago:not_found");
  }
  return token;
}

export async function acceptInvitation(userId: string, token: string): Promise<string> {
  if (getDataMode() === "supabase") {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("accept_invitation", { p_token: token });
    if (error) {
      throw new Error(error.message);
    }
    return String(data);
  }

  const rows = await withUser(userId, (tx) =>
    tx<{ accept_invitation: string }[]>`
      select public.accept_invitation(${token}) as accept_invitation
    `,
  );
  const businessId = rows[0]?.accept_invitation;
  if (!businessId) {
    throw new Error("iago:invitation_invalid");
  }
  return businessId;
}

export async function setBusinessStatus(userId: string, businessId: string, status: string) {
  await run(
    userId,
    (tx) => tx`select public.set_business_status(${businessId}::uuid, ${status})`,
    (client) => client.rpc("set_business_status", { p_business_id: businessId, p_status: status }),
  );
}

export async function updateBusinessProfile(
  userId: string,
  businessId: string,
  input: {
    name: string;
    timezone: string;
    currency: string;
    locale: string;
    contactEmail: string | null;
  },
) {
  await run(
    userId,
    (tx) => tx`
      select public.update_business_profile(
        ${businessId}::uuid,
        ${input.name},
        ${input.timezone},
        ${input.currency},
        ${input.locale},
        ${input.contactEmail}
      )
    `,
    (client) =>
      client.rpc("update_business_profile", {
        p_business_id: businessId,
        p_name: input.name,
        p_timezone: input.timezone,
        p_currency: input.currency,
        p_locale: input.locale,
        p_contact_email: input.contactEmail,
      }),
  );
}

export async function revokeMember(userId: string, businessId: string, memberId: string) {
  await run(
    userId,
    (tx) => tx`select public.revoke_member(${businessId}::uuid, ${memberId}::uuid)`,
    (client) => client.rpc("revoke_member", { p_business_id: businessId, p_user_id: memberId }),
  );
}

export async function setMemberPermissions(
  userId: string,
  businessId: string,
  memberId: string,
  permissions: PermissionMap,
) {
  await run(
    userId,
    (tx) => tx`
      select public.set_member_permissions(
        ${businessId}::uuid,
        ${memberId}::uuid,
        ${tx.json(permissions)}
      )
    `,
    (client) =>
      client.rpc("set_member_permissions", {
        p_business_id: businessId,
        p_user_id: memberId,
        p_permissions: permissions,
      }),
  );
}

export async function updateOwnProfile(userId: string, fullName: string) {
  await run(
    userId,
    (tx) => tx`select public.update_own_profile(${fullName})`,
    (client) => client.rpc("update_own_profile", { p_full_name: fullName }),
  );
}

export async function setPlatformSetting(userId: string, key: string, value: string) {
  await run(
    userId,
    (tx) => tx`select public.set_platform_setting(${key}, ${value})`,
    (client) => client.rpc("set_platform_setting", { p_key: key, p_value: value }),
  );
}
