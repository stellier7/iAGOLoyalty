import { getDataMode } from "@/lib/config";
import { readSessionUserId } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/server/queries";
import type { Profile } from "@/server/types";

export async function currentUserId(): Promise<string | null> {
  const mode = getDataMode();
  if (mode === "local") {
    return readSessionUserId();
  }
  if (mode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }
  return null;
}

export async function currentProfile(): Promise<Profile | null> {
  const userId = await currentUserId();
  if (!userId) {
    return null;
  }
  return getProfile(userId);
}
