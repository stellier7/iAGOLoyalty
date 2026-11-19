import Link from "next/link";
import { platformCounts } from "@/server/queries";
import { requireAdmin } from "@/server/workspace";

export const metadata = { title: "Platform" };

export default async function AdminHomePage() {
  try {
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
            Create a business, invite its owner, and suspend the account if it should stop issuing
            loyalty activity. Subscription rows are manual for the pilot. Billing is not connected.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/admin/businesses/new" className="underline">
              Create a business
            </Link>
            <Link href="/admin/destinations" className="underline">
              Manage QR destinations
            </Link>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) {
      const digest = String((error as { digest?: string }).digest ?? "");
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
    const message = error instanceof Error ? error.message : "Unknown platform error";
    return (
      <div className="max-w-xl rounded-2xl border border-ink/10 bg-bone p-5">
        <h2 className="font-heading text-2xl text-ink">Could not load platform data</h2>
        <p className="mt-3 text-sm leading-6 text-ink break-words">{message}</p>
        <p className="mt-4 text-sm text-mute">
          Open <Link href="/ok" className="underline text-ink">/ok</Link> and check{" "}
          <code className="text-ink">db_role_switch</code>.
        </p>
      </div>
    );
  }
}
