import Link from "next/link";
import { programTypeLabel } from "@/domain/loyalty-labels";
import { hasPermission } from "@/domain/permissions";
import { ProgramForm, StampCodeForm } from "@/components/loyalty-forms";
import { QrCode } from "@/components/qr-code";
import { publicOrigin } from "@/lib/public-request";
import { listPrograms, listStampCodes } from "@/server/loyalty";
import { canManageSettings, requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Programs" };

export default async function ProgramsPage() {
  const workspace = await requireWorkspace();
  if (!workspace.business || !workspace.membership) {
    return <p className="text-sm">Join a business before creating a program.</p>;
  }
  const canEdit = canManageSettings(workspace.membership);
  const canStamp = hasPermission(workspace.membership.role, workspace.membership.permissions, "issue_stamps");
  if (!canEdit && !canStamp) {
    return <p className="text-sm">Program setup is limited to managers and staff who can issue stamps.</p>;
  }

  const programs = await listPrograms(workspace.userId, workspace.business.id);
  const codes = canStamp ? await listStampCodes(workspace.userId, workspace.business.id) : [];
  const origin = await publicOrigin();
  const joinUrl = `${origin}/join/${workspace.business.slug}`;
  const active = workspace.business.status === "active";

  return (
    <div className="grid gap-10">
      <section className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <QrCode value={joinUrl} label={`Enrollment QR for ${workspace.business.name}`} />
        <div>
          <h2 className="font-heading text-3xl">Enrollment</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Customers join at this link. New cards use the primary active program.
          </p>
          <p className="mt-3 break-all text-sm">{joinUrl}</p>
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="font-heading text-3xl">Programs</h2>
        {programs.length === 0 ? <p className="text-sm text-muted-foreground">No program yet.</p> : null}
        <div className="grid gap-3">
          {programs.map((program) => (
            <article key={program.id} className="rounded-xl border px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{program.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {programTypeLabel(program.programType)}
                  {program.isPrimary ? " · Primary" : ""}
                </p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {program.programType === "stamps"
                  ? `${program.stampsRequired} stamps, ${program.cooldownSeconds}s cooldown between the same static code.`
                  : `${program.pointsPerCurrencyUnit} points per ${program.currency}, minimum purchase ${program.minPurchaseAmount}.`}
              </p>
            </article>
          ))}
        </div>
      </section>
      {canEdit && active ? (
        <section className="max-w-2xl">
          <h2 className="font-heading text-3xl">New program</h2>
          <div className="mt-4">
            <ProgramForm businessId={workspace.business.id} currency={workspace.business.currency} />
          </div>
        </section>
      ) : null}
      {canStamp ? (
        <section className="grid gap-4">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl">Stamp QR and NFC</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A static code stays at the counter. A rotating code expires in 60 seconds and works once. The QR and the NFC tag use the same address. Write the NFC address onto the tag with `?via=nfc` so the ledger records a tap.
            </p>
            {active ? (
              <div className="mt-4">
                <StampCodeForm businessId={workspace.business.id} programs={programs} />
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            {codes.map((code) => (
              <Link key={code.code} href={`/app/codes/${code.code}`} className="text-sm underline">
                {code.label ?? "Stamp code"} · {code.kind}
                {code.usedAt ? " · used" : ""}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
