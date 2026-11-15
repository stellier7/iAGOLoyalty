import Link from "next/link";
import { businessStatusLabel, roleLabel } from "@/domain/labels";
import { QrCode } from "@/components/qr-code";
import { publicOrigin } from "@/lib/public-request";
import { loyaltyCounts, listPrograms } from "@/server/loyalty";
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
  const counts = await loyaltyCounts(workspace.userId, workspace.business.id);
  const programs = await listPrograms(workspace.userId, workspace.business.id);
  const origin = await publicOrigin();
  const joinUrl = `${origin}/join/${workspace.business.slug}`;

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Customers" value={String(counts.customers)} />
        <Metric label="Stamps issued" value={String(counts.stampsIssued)} />
        <Metric label="Points issued" value={String(counts.pointsIssued)} />
        <Metric label="Rewards redeemed" value={String(counts.redemptions)} />
        <Metric label="Active team members" value={String(activeMembers)} />
        <Metric label="Pending invitations" value={canManageTeam(workspace.membership) ? String(pendingInvites) : "Hidden"} />
      </section>
      <section className="max-w-2xl">
        <h2 className="font-heading text-3xl">{workspace.business.name}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          You are signed in as {roleLabel(workspace.membership.role).toLowerCase()}. The business is {businessStatusLabel(workspace.business.status).toLowerCase()}, uses {workspace.business.currency}, and keeps customer-facing copy in {workspace.business.locale === "es" ? "Spanish" : "English"}.
        </p>
      </section>
      <section className="grid gap-4 border-t pt-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {programs.length > 0 ? <QrCode value={joinUrl} label={`Enrollment QR for ${workspace.business.name}`} /> : <div />}
        <article>
          <h3 className="text-sm font-medium">Enrollment</h3>
          {programs.length > 0 ? (
            <p className="mt-2 break-all text-sm leading-6">{joinUrl}</p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Create a program before sharing an enrollment link. Stamp QR codes and NFC tags use the same stamp address.
            </p>
          )}
          <Link href="/app/programs" className="mt-3 inline-block text-sm underline">
            Open programs
          </Link>
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
