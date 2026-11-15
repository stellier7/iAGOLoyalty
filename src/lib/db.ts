import postgres from "postgres";

let appDb: ReturnType<typeof postgres> | undefined;
let adminDb: ReturnType<typeof postgres> | undefined;

export function getAppDb() {
  const url = process.env.LOCAL_DATABASE_URL;
  if (!url) {
    throw new Error("LOCAL_DATABASE_URL is not set");
  }
  appDb ??= postgres(url, { max: 8, prepare: false });
  return appDb;
}

export function getAdminDb() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local admin database access is disabled in production.");
  }
  const url = process.env.LOCAL_DATABASE_ADMIN_URL;
  if (!url) {
    throw new Error("LOCAL_DATABASE_ADMIN_URL is not set");
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
