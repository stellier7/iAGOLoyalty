import { notFound } from "next/navigation";
import { businessStatusLabel, memberStatusLabel, roleLabel } from "@/domain/labels";
import { SubmitButton } from "@/components/submit-button";
import { setBusinessStatusAction } from "@/server/actions";
import { getBusiness, getSubscription, listTeam } from "@/server/queries";
import { requireAdmin } from "@/server/workspace";

export const metadata = { title: "Business" };

export default async function BusinessDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { userId } = await requireAdmin();
  const business = await getBusiness(userId, id);
  if (!business) {
    notFound();
  }
  const subscription = await getSubscription(userId, id);
  const team = await listTeam(userId, id);
  const nextStatus = business.status === "suspended" ? "active" : "suspended";

  return (
    <div className="grid max-w-3xl gap-8">
      {query.error ? <p className="text-sm text-destructive">{query.error}</p> : null}
      <section>
        <h2 className="font-heading text-3xl">{business.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {business.slug} · {businessStatusLabel(business.status)} · {business.currency} · {subscription?.planCode ?? "pilot"} / {subscription?.status ?? "manual"}
        </p>
        <form action={setBusinessStatusAction} className="mt-4">
          <input type="hidden" name="businessId" value={business.id} />
          <input type="hidden" name="status" value={nextStatus} />
          <SubmitButton variant={nextStatus === "suspended" ? "destructive" : "default"}>
            {nextStatus === "suspended" ? "Suspend business" : "Reactivate business"}
          </SubmitButton>
        </form>
      </section>
      <section>
        <h3 className="font-heading text-2xl">Members</h3>
        <ul className="mt-3 grid gap-2 text-sm">
          {team.length === 0 ? <li className="text-muted-foreground">No members have accepted an invitation yet.</li> : null}
          {team.map((member) => (
            <li key={member.userId}>
              {member.fullName ?? member.email} · {roleLabel(member.role)} · {memberStatusLabel(member.status)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
