import Link from "next/link";
import { platformCounts } from "@/server/queries";
import { requireAdmin } from "@/server/workspace";

export const metadata = { title: "Platform" };

export default async function AdminHomePage() {
  const { userId } = await requireAdmin();
  const counts = await platformCounts(userId);

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border bg-card px-4 py-4">
          <p className="text-sm text-muted-foreground">Businesses</p>
          <p className="mt-2 font-heading text-3xl">{counts.businesses}</p>
        </article>
        <article className="rounded-xl border bg-card px-4 py-4">
          <p className="text-sm text-muted-foreground">Suspended</p>
          <p className="mt-2 font-heading text-3xl">{counts.suspendedBusinesses}</p>
        </article>
        <article className="rounded-xl border bg-card px-4 py-4">
          <p className="text-sm text-muted-foreground">Active memberships</p>
          <p className="mt-2 font-heading text-3xl">{counts.activeMembers}</p>
        </article>
      </section>
      <section className="max-w-2xl">
        <h2 className="font-heading text-3xl">Platform administration</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Create a business, invite its owner, and suspend the account if it should stop issuing loyalty activity. Subscription rows are manual for the pilot. Billing is not connected.
        </p>
        <Link href="/admin/businesses/new" className="mt-4 inline-block text-sm underline">
          Create a business
        </Link>
      </section>
    </div>
  );
}
