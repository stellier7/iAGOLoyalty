import { createClient } from "@supabase/supabase-js";
import { hashPassword, verifyPassword } from "@/domain/password";
import { accountMode } from "@/lib/config";
import { getAdminDb } from "@/lib/db";

export async function platformHasSuperAdmin(): Promise<boolean | null> {
  const mode = accountMode();
  if (mode === "database") {
    try {
      const rows = await getAdminDb()<{ exists: boolean }[]>`
        select exists(
          select 1 from public.profiles where platform_role = 'super_admin'
        ) as exists
      `;
      return rows[0]?.exists ?? false;
    } catch {
      return null;
    }
  }

  if (mode !== "supabase" || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const admin = supabaseAdmin();
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("platform_role", "super_admin");
  if (error) {
    return null;
  }
  return (count ?? 0) > 0;
}

export async function verifyLocalLogin(email: string, password: string): Promise<string | null> {
  const rows = await getAdminDb()<{ id: string; password_hash: string }[]>`
    select u.id, c.password_hash
    from auth.users u
    join auth.local_credentials c on c.user_id = u.id
    where lower(u.email) = lower(${email.trim()})
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }
  const matches = await verifyPassword(password, row.password_hash);
  return matches ? row.id : null;
}

/** Reset password for an existing super admin using the SETUP_TOKEN gate (caller checks token). */
export async function resetLocalSuperAdminPassword(email: string, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  const rows = await getAdminDb()<{ id: string }[]>`
    update auth.local_credentials c
    set password_hash = ${passwordHash}
    from auth.users u
    join public.profiles p on p.id = u.id
    where c.user_id = u.id
      and lower(u.email) = lower(${email.trim()})
      and p.platform_role = 'super_admin'
    returning u.id
  `;
  return Boolean(rows[0]?.id);
}

export async function createLocalUser(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<string> {
  const passwordHash = await hashPassword(input.password);
  const id = crypto.randomUUID();
  const admin = getAdminDb();
  await admin.begin(async (tx) => {
    await tx`
      insert into auth.users (id, email, raw_user_meta_data)
      values (
        ${id},
        ${input.email.trim()},
        ${tx.json({ full_name: input.fullName.trim() })}
      )
    `;
    await tx`
      insert into auth.local_credentials (user_id, password_hash)
      values (${id}, ${passwordHash})
    `;
  });
  return id;
}

export async function promoteFirstLocalSuperAdmin(userId: string) {
  const admin = getAdminDb();
  await admin.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(14011)`;
    const existing = await tx<{ count: number }[]>`
      select count(*)::int as count
      from public.profiles
      where platform_role = 'super_admin'
    `;
    if ((existing[0]?.count ?? 0) > 0) {
      throw new Error("iago:not_authorized");
    }
    await tx`
      update public.profiles
      set platform_role = 'super_admin'
      where id = ${userId}
    `;
  });
}

export async function createSupabaseUser(input: {
  email: string;
  password: string;
  fullName: string;
  superAdmin?: boolean;
}): Promise<string> {
  const admin = supabaseAdmin();
  if (input.superAdmin) {
    const existing = await platformHasSuperAdmin();
    if (existing) {
      throw new Error("iago:not_authorized");
    }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "iago:invalid_email");
  }

  if (input.superAdmin) {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ platform_role: "super_admin" })
      .eq("id", data.user.id);
    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return data.user.id;
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
