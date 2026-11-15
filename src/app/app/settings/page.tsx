import { BusinessProfileForm, NameForm } from "@/components/business-forms";
import { BrandingForm } from "@/components/loyalty-forms";
import { getBranding } from "@/server/loyalty";
import { canManageSettings, requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const workspace = await requireWorkspace();
  if (!workspace.membership) {
    return <p className="text-sm">Join a business before changing settings.</p>;
  }

  const canEditBusiness = canManageSettings(workspace.membership) && workspace.business?.status === "active";
  const branding = workspace.business ? await getBranding(workspace.userId, workspace.business.id) : null;

  return (
    <div className="grid max-w-2xl gap-10">
      <section>
        <h2 className="font-heading text-3xl">Your account</h2>
        <div className="mt-4">
          <NameForm fullName={workspace.profile.fullName ?? ""} />
        </div>
      </section>
      {workspace.business ? (
        <section>
          <h2 className="font-heading text-3xl">Business profile</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Slug: {workspace.business.slug}. The slug stays fixed after creation so enrollment links do not change.
          </p>
          <div className="mt-4">
            {canEditBusiness ? (
              <BusinessProfileForm
                businessId={workspace.business.id}
                name={workspace.business.name}
                timezone={workspace.business.timezone}
                currency={workspace.business.currency}
                locale={workspace.business.locale}
                contactEmail={workspace.business.contactEmail}
              />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {workspace.business.status !== "active"
                  ? "Business profile edits are blocked while the account is suspended."
                  : "Your role can view this business, and only owners, admins, or employees with settings permission can change it."}
              </p>
            )}
          </div>
        </section>
      ) : null}
      {workspace.business && branding ? (
        <section>
          <h2 className="font-heading text-3xl">Branding</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            These colors and the logo appear on the enrollment page and the customer card.
          </p>
          <div className="mt-4">
            {canEditBusiness ? (
              <BrandingForm
                businessId={workspace.business.id}
                brandColor={branding.brandColor}
                brandColorSecondary={branding.brandColorSecondary}
                logoUrl={branding.logoUrl}
              />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {branding.brandColor ?? "No brand color yet"}. {branding.logoUrl ?? "No logo URL yet"}.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
