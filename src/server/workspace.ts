import { redirect } from "next/navigation";
import { hasPermission } from "@/domain/permissions";
import { readBusinessId } from "@/lib/session";
import { currentUserId } from "@/server/current-user";
import { getBusiness, getProfile, getSubscription, listMemberships } from "@/server/queries";

export async function requireWorkspace() {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }
  const profile = await getProfile(userId);
  if (!profile) {
    redirect("/login");
  }

  const memberships = await listMemberships(userId);
  const requested = await readBusinessId();
  const membership = memberships.find((item) => item.businessId === requested) ?? memberships[0] ?? null;
  const business = membership ? await getBusiness(userId, membership.businessId) : null;
  const subscription = membership ? await getSubscription(userId, membership.businessId) : null;

  return { userId, profile, memberships, membership, business, subscription };
}

export async function requireAdmin() {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }
  const profile = await getProfile(userId);
  if (!profile) {
    redirect("/login");
  }
  if (profile.platformRole !== "super_admin") {
    redirect("/app");
  }
  return { userId, profile };
}

export function canManageTeam(membership: { role: "owner" | "admin" | "employee"; permissions: Parameters<typeof hasPermission>[1] } | null) {
  if (!membership) {
    return false;
  }
  return hasPermission(membership.role, membership.permissions, "manage_team");
}

export function canManageSettings(membership: { role: "owner" | "admin" | "employee"; permissions: Parameters<typeof hasPermission>[1] } | null) {
  if (!membership) {
    return false;
  }
  return hasPermission(membership.role, membership.permissions, "manage_settings");
}
