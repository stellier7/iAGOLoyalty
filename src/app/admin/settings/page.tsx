import { PlatformSettingForm } from "@/components/business-forms";
import { listPlatformSettings } from "@/server/queries";
import { requireAdmin } from "@/server/workspace";

export const metadata = { title: "Platform settings" };

export default async function PlatformSettingsPage() {
  const { userId } = await requireAdmin();
  const settings = await listPlatformSettings(userId);

  return (
    <div className="grid max-w-xl gap-8">
      <section>
        <h2 className="font-heading text-3xl">Platform settings</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          These values are stored for the platform. They do not send email or change a tenant’s branding.
        </p>
      </section>
      <PlatformSettingForm settingKey="product_name" label="Product name" value={settings.product_name ?? "iAGO Loyalty"} />
      <PlatformSettingForm settingKey="support_email" label="Support email" value={settings.support_email ?? ""} />
    </div>
  );
}
