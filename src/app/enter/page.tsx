import { redirect } from "next/navigation";
import { readBusinessId, writeBusinessId } from "@/lib/session";
import { currentUserId } from "@/server/current-user";
import { getProfile, listMemberships } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function EnterPage() {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }

  try {
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
  } catch {
    redirect("/login");
  }

  redirect("/app");
}
