export type DataMode = "supabase" | "local" | "unconfigured";

export function getDataMode(): DataMode {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "supabase";
  }

  if (process.env.NODE_ENV === "production") {
    return "unconfigured";
  }

  if (
    process.env.LOCAL_DATABASE_URL &&
    process.env.LOCAL_DATABASE_ADMIN_URL &&
    process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET.length >= 32
  ) {
    return "local";
  }

  return "unconfigured";
}
