import { BusinessProfileForm, NameForm } from "@/components/business-forms";
import { canManageSettings, requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const workspace = await requireWorkspace();
  if (!workspace.membership) {
    return <p className="text-sm">Join a business before changing settings.</p>;
  }

  const canEditBusiness = canManageSettings(workspace.membership) && workspace.business?.status === "active";

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
    </div>
  );
}
