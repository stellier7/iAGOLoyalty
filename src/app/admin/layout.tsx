import { AppFrame } from "@/components/app-frame";
import { requireAdmin } from "@/server/workspace";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  return (
    <AppFrame
      area="Platform"
      heading="iAGO Loyalty"
      profileName={profile.fullName ?? profile.email ?? "Super admin"}
      items={[
        { href: "/admin", label: "Overview" },
        { href: "/admin/businesses", label: "Businesses" },
        { href: "/admin/settings", label: "Settings" },
        { href: "/app", label: "Business app" },
      ]}
    >
      {children}
    </AppFrame>
  );
}
