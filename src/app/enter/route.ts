import { redirect } from "next/navigation";
import { readBusinessId, writeBusinessId } from "@/lib/session";
import { currentUserId } from "@/server/current-user";
import { getProfile, listMemberships } from "@/server/queries";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }

  const memberships = await listMemberships(userId);
  const requested = await readBusinessId();
  const chosen = memberships.find((membership) => membership.businessId === requested) ?? memberships[0];
  if (chosen) {
    await writeBusinessId(chosen.businessId);
    redirect("/app");
  }

  const profile = await getProfile(userId);
  if (profile?.platformRole === "super_admin") {
    redirect("/admin");
  }

  redirect("/app");
}
