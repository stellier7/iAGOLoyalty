import Link from "next/link";
import { businessStatusLabel, roleLabel } from "@/domain/labels";
import { listInvitations, listTeam } from "@/server/queries";
import { canManageTeam, requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const workspace = await requireWorkspace();
  if (!workspace.business || !workspace.membership) {
    return (
      <section className="max-w-xl">
        <h2 className="font-heading text-3xl">No business membership</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This account is not on a business team yet. Open an invitation link from the business owner, or ask a platform admin to create the business.
        </p>
      </section>
    );
  }

  const team = await listTeam(workspace.userId, workspace.business.id);
  const invitations = canManageTeam(workspace.membership)
    ? await listInvitations(workspace.userId, workspace.business.id)
    : [];
  const pendingInvites = invitations.filter((invitation) => !invitation.acceptedAt).length;
  const activeMembers = team.filter((member) => member.status === "active").length;

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Active team members" value={String(activeMembers)} />
        <Metric label="Pending invitations" value={canManageTeam(workspace.membership) ? String(pendingInvites) : "Hidden"} />
        <Metric label="Plan" value={workspace.subscription?.planCode ?? "pilot"} />
      </section>
      <section className="max-w-2xl">
        <h2 className="font-heading text-3xl">{workspace.business.name}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          You are signed in as {roleLabel(workspace.membership.role).toLowerCase()}. The business is {businessStatusLabel(workspace.business.status).toLowerCase()}, uses {workspace.business.currency}, and keeps customer-facing copy in {workspace.business.locale === "es" ? "Spanish" : "English"}.
        </p>
      </section>
      <section className="grid gap-3 border-t pt-6 sm:grid-cols-2">
        <article>
          <h3 className="text-sm font-medium">Loyalty programs</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Stamp cards and points programs are not in this release. Balances will be posted through a ledger, not edited by hand.
          </p>
        </article>
        <article>
          <h3 className="text-sm font-medium">Stamp QR and NFC</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            A stamp will be collectible from a QR code or an NFC tag. Both will open the same short-lived HTTPS link, so the phone does not need a separate app.
          </p>
        </article>
      </section>
      {workspace.profile.platformRole === "super_admin" ? (
        <Link href="/admin" className="text-sm underline">
          Open platform admin
        </Link>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border bg-card px-4 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-3xl capitalize">{value}</p>
    </article>
  );
}
