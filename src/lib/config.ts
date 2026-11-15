export type DataMode = "supabase" | "local" | "hosted" | "unconfigured";
export type AccountMode = "database" | "supabase" | "unconfigured";

export function getDataMode(): DataMode {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "supabase";
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.LOCAL_DATABASE_URL &&
    process.env.LOCAL_DATABASE_ADMIN_URL &&
    process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET.length >= 32
  ) {
    return "local";
  }

  if (process.env.DATABASE_URL && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
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
