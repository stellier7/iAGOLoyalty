import { AppFrame } from "@/components/app-frame";
import { businessStatusLabel } from "@/domain/labels";
import { canManageTeam, requireWorkspace } from "@/server/workspace";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspace();
  const items = [{ href: "/app", label: "Overview" }];
  if (canManageTeam(workspace.membership)) {
    items.push({ href: "/app/team", label: "Team" });
  }
  if (workspace.membership) {
    items.push({ href: "/app/settings", label: "Settings" });
  }
  if (workspace.profile.platformRole === "super_admin") {
    items.push({ href: "/admin", label: "Platform admin" });
  }

  const heading = workspace.business?.name ?? "No business yet";
  const notice = workspace.business && workspace.business.status !== "active"
    ? `${workspace.business.name} is ${businessStatusLabel(workspace.business.status).toLowerCase()}. Members can still view it. Changes are blocked.`
    : undefined;

  return (
    <AppFrame
      area="Business"
      items={items}
      heading={heading}
      profileName={workspace.profile.fullName ?? workspace.profile.email ?? "Account"}
      memberships={workspace.memberships.map((membership) => ({
        id: membership.businessId,
        name: membership.businessName,
      }))}
      activeBusinessId={workspace.membership?.businessId}
      notice={notice}
    >
      {children}
    </AppFrame>
  );
}
