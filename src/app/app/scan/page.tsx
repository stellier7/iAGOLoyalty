import { hasPermission } from "@/domain/permissions";
import { programTypeLabel } from "@/domain/loyalty-labels";
import { membershipTokenFromInput } from "@/domain/card-token";
import { AddStampForm, CustomerLookup, PurchaseForm, RedeemForm } from "@/components/scan-forms";
import { toActionError } from "@/lib/errors";
import { staffLookup } from "@/server/loyalty";
import { requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Scan" };

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  if (!workspace.business || !workspace.membership) {
    return <p className="text-sm">Join a business before scanning a card.</p>;
  }
  const membership = workspace.membership;
  if (!hasPermission(membership.role, membership.permissions, "scan")) {
    return <p className="text-sm">Scanning is limited to staff with scan permission.</p>;
  }
  const token = params.token ? membershipTokenFromInput(params.token) : null;
  let lookupError: string | null = null;
  const customer = token
    ? await staffLookup(workspace.userId, token).catch((error: unknown) => {
        lookupError = toActionError(error);
        return null;
      })
    : null;
  const done =
    params.done === "stamp" ? "Stamp added." : params.done === "purchase" ? "Purchase recorded." : params.done === "redeem" ? "Reward redeemed." : null;

  return (
    <div className="grid gap-8">
      <section>
        <h2 className="font-heading text-3xl">Scan</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Paste the customer card link, or use the camera where the browser can read QR codes. Stamps, points, and redemptions are posted to the ledger.
        </p>
        <div className="mt-4">
          <CustomerLookup initialToken={params.token} />
        </div>
      </section>
      {done ? <p className="text-sm">{done}</p> : null}
      {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}
      {customer && token ? (
        <section className="grid max-w-xl gap-6 rounded-xl border px-4 py-4">
          <div>
            <h3 className="font-heading text-2xl">{customer.firstName} {customer.lastName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.membershipNumber} · {programTypeLabel(customer.programType)} · {customer.programName}
            </p>
            <p className="mt-3 text-sm">
              {customer.programType === "stamps"
                ? `${customer.stampsBalance} of ${customer.stampsRequired ?? 0} stamps`
                : `${customer.pointsBalance} points`}
            </p>
          </div>
          {workspace.business.status === "active" && customer.programType === "stamps" && hasPermission(membership.role, membership.permissions, "issue_stamps") ? (
            <AddStampForm token={token} />
          ) : null}
          {workspace.business.status === "active" && customer.programType === "points" && hasPermission(membership.role, membership.permissions, "issue_points") ? (
            <PurchaseForm token={token} />
          ) : null}
          {workspace.business.status === "active" && hasPermission(membership.role, membership.permissions, "redeem") ? (
            <RedeemForm token={token} customer={customer} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
