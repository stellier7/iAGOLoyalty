export type DataMode = "supabase" | "local" | "hosted" | "unconfigured";
export type AccountMode = "database" | "supabase" | "unconfigured";

export type AuthConfigReport = {
  mode: DataMode;
  hasDatabaseUrl: boolean;
  hasSessionSecret: boolean;
  sessionSecretLongEnough: boolean;
  missing: string[];
};

/** Read server env at request time (avoid static `process.env.NAME` inlining). */
function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Prefer app names; fall back to Vercel Neon Storage names. */
export function hostedDatabaseUrl(): string | null {
  const value = env("DATABASE_URL") || env("POSTGRES_URL") || env("POSTGRES_PRISMA_URL");
  return value || null;
}

export function hostedDatabaseUrlUnpooled(): string | null {
  const value = env("DATABASE_URL_UNPOOLED") || env("POSTGRES_URL_NON_POOLING") || hostedDatabaseUrl() || "";
  return value || null;
}

export function sessionSecretValue(): string {
  return env("SESSION_SECRET");
}

export function describeAuthConfig(mode: DataMode = getDataMode()): AuthConfigReport {
  const secret = sessionSecretValue();
  const hasDatabaseUrl = Boolean(hostedDatabaseUrl());
  const hasSessionSecret = secret.length > 0;
  const sessionSecretLongEnough = secret.length >= 32;
  const missing: string[] = [];

  if (mode === "supabase") {
    return {
      mode,
      hasDatabaseUrl,
      hasSessionSecret,
      sessionSecretLongEnough,
      missing,
    };
  }

  if (!hasDatabaseUrl) {
    missing.push("POSTGRES_URL or DATABASE_URL");
  }
  if (!hasSessionSecret) {
    missing.push("SESSION_SECRET");
  } else if (!sessionSecretLongEnough) {
    missing.push("SESSION_SECRET (needs 32+ characters)");
  }

  return {
    mode,
    hasDatabaseUrl,
    hasSessionSecret,
    sessionSecretLongEnough,
    missing,
  };
}

export function unconfiguredAuthMessage(report: AuthConfigReport = describeAuthConfig()): string {
  if (report.missing.length === 0) {
    return "Authentication is not configured yet.";
  }
  return `Authentication is not configured yet. Missing in Vercel env: ${report.missing.join(", ")}. Neon adds the database URL; SESSION_SECRET must be set manually (32+ chars), then redeploy.`;
}

export function getDataMode(): DataMode {
  if (env("NEXT_PUBLIC_SUPABASE_URL") && env("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    return "supabase";
  }

  const secret = sessionSecretValue();
  if (
    env("NODE_ENV") !== "production" &&
    env("LOCAL_DATABASE_URL") &&
    env("LOCAL_DATABASE_ADMIN_URL") &&
    secret.length >= 32
  ) {
    return "local";
  }

  if (hostedDatabaseUrl() && secret.length >= 32) {
    return "hosted";
  }

  return "unconfigured";
}

export function accountMode(mode: DataMode = getDataMode()): AccountMode {
  switch (mode) {
    case "local":
    case "hosted":
      return "database";
    case "supabase":
      return "supabase";
    case "unconfigured":
      return "unconfigured";
    default: {
      const unknown: never = mode;
      return unknown;
    }
  }
}
