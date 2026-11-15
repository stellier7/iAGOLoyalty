import { AppFrame } from "@/components/app-frame";
import { businessStatusLabel } from "@/domain/labels";
import { hasPermission, type EmployeePermission } from "@/domain/permissions";
import { canManageTeam, requireWorkspace } from "@/server/workspace";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspace();
  const allow = (permission: EmployeePermission) =>
    workspace.membership ? hasPermission(workspace.membership.role, workspace.membership.permissions, permission) : false;
  const items = [{ href: "/app", label: "Overview" }];
  if (allow("scan")) {
    items.push({ href: "/app/scan", label: "Scan" });
  }
  if (allow("view_customers")) {
    items.push({ href: "/app/customers", label: "Customers" });
  }
  if (workspace.membership) {
    items.push({ href: "/app/transactions", label: "Transactions" });
  }
  if (allow("manage_settings") || allow("issue_stamps")) {
    items.push({ href: "/app/programs", label: "Programs" });
  }
  if (allow("manage_settings")) {
    items.push({ href: "/app/rewards", label: "Rewards" });
  }
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
