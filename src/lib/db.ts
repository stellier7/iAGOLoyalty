import postgres from "postgres";
import { hostedDatabaseUrl, hostedDatabaseUrlUnpooled } from "./config";

let appDb: ReturnType<typeof postgres> | undefined;
let adminDb: ReturnType<typeof postgres> | undefined;

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
    `Database role switch to "${role}" failed (${message}). On Neon, set POSTGRES_URL_NON_POOLING and ensure migrate granted anon/authenticated to the DB user.`,
  );
}

export async function withAnon<T>(run: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  try {
    return await getAppDb().begin(async (tx) => {
      await tx.unsafe("set local role anon");
      return run(tx);
    });
  } catch (error) {
    throw roleError(error, "anon");
  }
}

export async function withUser<T>(
  userId: string,
  run: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  try {
    return await getAppDb().begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx.unsafe("set local role authenticated");
      return run(tx);
    });
  } catch (error) {
    throw roleError(error, "authenticated");
  }
}
