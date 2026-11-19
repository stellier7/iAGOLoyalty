import postgres from "postgres";
import { hostedDatabaseUrl, hostedDatabaseUrlUnpooled } from "./config";

let appDb: ReturnType<typeof postgres> | undefined;
let adminDb: ReturnType<typeof postgres> | undefined;
let roleGrantPromise: Promise<void> | undefined;

/**
 * Tenant queries need `SET LOCAL ROLE authenticated`. Neon's pooled URL
 * (PgBouncer transaction mode) often rejects that — prefer the direct URL.
 */
function appDatabaseUrl() {
  if (process.env.NODE_ENV !== "production" && process.env.LOCAL_DATABASE_URL) {
    return process.env.LOCAL_DATABASE_URL;
  }
  return (
    hostedDatabaseUrlUnpooled() ??
    hostedDatabaseUrl() ??
    process.env.LOCAL_DATABASE_URL ??
    null
  );
}

export function getAppDb() {
  const url = appDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL or LOCAL_DATABASE_URL is not set");
  }
  appDb ??= postgres(url, { max: 8, prepare: false });
  return appDb;
}

export function getAdminDb() {
  const url =
    process.env.NODE_ENV === "production"
      ? hostedDatabaseUrlUnpooled() ?? hostedDatabaseUrl()
      : process.env.LOCAL_DATABASE_ADMIN_URL;
  if (!url) {
    throw new Error(
      process.env.NODE_ENV === "production"
        ? "DATABASE_URL (or POSTGRES_URL) is not set"
        : "LOCAL_DATABASE_ADMIN_URL is not set",
    );
  }
  adminDb ??= postgres(url, { max: 2, prepare: false });
  return adminDb;
}

function roleError(error: unknown, role: "anon" | "authenticated"): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `Database role switch to "${role}" failed (${message}). On Neon, set POSTGRES_URL_NON_POOLING and ensure migrate granted anon/authenticated WITH SET TRUE to the DB user.`,
  );
}

function isRoleSwitchDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /permission denied to set role/i.test(message);
}

/** SQL that makes SET ROLE work even when Neon left membership with SET false. */
export const ENSURE_APP_ROLE_GRANTS_SQL = `
do $iago_roles$
declare
  can_set boolean;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  begin
    execute 'grant anon to current_user with set true, inherit false';
  exception
    when insufficient_privilege then
      select exists (
        select 1
        from pg_auth_members m
        join pg_roles r on r.oid = m.roleid
        join pg_roles u on u.oid = m.member
        where r.rolname = 'anon'
          and u.rolname = current_user
          and m.set_option
      ) into can_set;
      if not coalesce(can_set, false) then
        raise exception 'iago: % cannot SET ROLE anon (need GRANT anon TO CURRENT_USER WITH SET TRUE)', current_user;
      end if;
  end;

  begin
    execute 'grant authenticated to current_user with set true, inherit false';
  exception
    when insufficient_privilege then
      select exists (
        select 1
        from pg_auth_members m
        join pg_roles r on r.oid = m.roleid
        join pg_roles u on u.oid = m.member
        where r.rolname = 'authenticated'
          and u.rolname = current_user
          and m.set_option
      ) into can_set;
      if not coalesce(can_set, false) then
        raise exception 'iago: % cannot SET ROLE authenticated (need GRANT authenticated TO CURRENT_USER WITH SET TRUE)', current_user;
      end if;
  end;
end
$iago_roles$;
`;

/**
 * Neon / PG16 may leave the login user as a member of `authenticated` with
 * SET false, which blocks `SET LOCAL ROLE`. Re-grant WITH SET TRUE once.
 */
export async function ensureAppRoleGrants(): Promise<void> {
  roleGrantPromise ??= (async () => {
    const db = getAdminDb();
    await db.unsafe(ENSURE_APP_ROLE_GRANTS_SQL);
  })().catch((error) => {
    roleGrantPromise = undefined;
    throw error;
  });
  await roleGrantPromise;
}

/** Reset cached clients/grants (tests only). */
export function resetAppRoleGrantCache(): void {
  roleGrantPromise = undefined;
  const closing: Array<Promise<void>> = [];
  if (appDb) {
    closing.push(appDb.end({ timeout: 1 }).then(() => undefined));
    appDb = undefined;
  }
  if (adminDb) {
    closing.push(adminDb.end({ timeout: 1 }).then(() => undefined));
    adminDb = undefined;
  }
  void Promise.all(closing);
}

async function beginAsRole<T>(
  role: "anon" | "authenticated",
  run: (tx: postgres.TransactionSql) => Promise<T>,
  beforeRole?: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<T> {
  try {
    return await getAppDb().begin(async (tx) => {
      if (beforeRole) {
        await beforeRole(tx);
      }
      await tx.unsafe(`set local role ${role}`);
      return run(tx);
    });
  } catch (error) {
    if (!isRoleSwitchDenied(error)) {
      throw roleError(error, role);
    }
    try {
      await ensureAppRoleGrants();
    } catch (grantError) {
      throw roleError(grantError, role);
    }
    try {
      return await getAppDb().begin(async (tx) => {
        if (beforeRole) {
          await beforeRole(tx);
        }
        await tx.unsafe(`set local role ${role}`);
        return run(tx);
      });
    } catch (retryError) {
      throw roleError(retryError, role);
    }
  }
}

export async function withAnon<T>(run: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return beginAsRole("anon", run);
}

export async function withUser<T>(
  userId: string,
  run: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return beginAsRole("authenticated", run, async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
  });
}
