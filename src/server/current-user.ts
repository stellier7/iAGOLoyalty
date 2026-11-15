import { accountMode } from "@/lib/config";
import { readSessionUserId } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/server/queries";
import type { Profile } from "@/server/types";

export async function currentUserId(): Promise<string | null> {
  const mode = accountMode();
  switch (mode) {
    case "database":
      return readSessionUserId();
    case "supabase": {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    }
    case "unconfigured":
      return null;
    default: {
      const unknown: never = mode;
      return unknown;
    }
  }
}

export async function currentProfile(): Promise<Profile | null> {
  const userId = await currentUserId();
  if (!userId) {
    return null;
  }
  return getProfile(userId);
}
