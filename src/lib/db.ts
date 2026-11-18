import postgres from "postgres";
import { hostedDatabaseUrl } from "./config";

let appDb: ReturnType<typeof postgres> | undefined;
let adminDb: ReturnType<typeof postgres> | undefined;

function appDatabaseUrl() {
  if (process.env.NODE_ENV !== "production" && process.env.LOCAL_DATABASE_URL) {
    return process.env.LOCAL_DATABASE_URL;
  }
  return hostedDatabaseUrl() ?? process.env.LOCAL_DATABASE_URL ?? null;
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
    process.env.NODE_ENV === "production" ? hostedDatabaseUrl() : process.env.LOCAL_DATABASE_ADMIN_URL;
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

export async function withAnon<T>(run: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return getAppDb().begin(async (tx) => {
    await tx.unsafe("set local role anon");
    return run(tx);
  });
}

export async function withUser<T>(
  userId: string,
  run: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return getAppDb().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx.unsafe("set local role authenticated");
    return run(tx);
  });
}
