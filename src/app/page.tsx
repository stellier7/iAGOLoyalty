import Link from "next/link";
import { redirect } from "next/navigation";
import { getDataMode } from "@/lib/config";
import { buttonVariants } from "@/components/ui/button";
import { platformHasSuperAdmin } from "@/server/accounts";
import { currentProfile } from "@/server/current-user";

export default async function HomePage() {
  const profile = await currentProfile();
  if (profile) {
    redirect("/enter");
  }

  const mode = getDataMode();
  const hasAdmin = mode === "unconfigured" ? null : await platformHasSuperAdmin();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm tracking-[0.22em] text-muted-foreground uppercase">iAGO Digital</p>
      <h1 className="mt-4 max-w-xl font-heading text-5xl leading-tight text-balance">
        Loyalty, kept separate for every business.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
        iAGO Loyalty is a multi-tenant platform for cafés, salons, shops, and our own perfumery. Each business has its own customers, team, stamp card or points program, and ledger.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className={buttonVariants()}>
          Sign in
        </Link>
        {hasAdmin === false ? (
          <Link href="/setup" className={buttonVariants({ variant: "outline" })}>
            Create the first admin
          </Link>
        ) : null}
      </div>
      {mode === "unconfigured" ? (
        <p className="mt-8 max-w-xl text-sm leading-6 text-muted-foreground">
          Add Supabase environment variables, or local database settings from `.env.example`, before signing in. No credentials are included in the repository.
        </p>
      ) : null}
      <dl className="mt-14 grid gap-6 border-t pt-8 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-medium">One database, separate tenants</dt>
          <dd className="mt-2 text-sm leading-6 text-muted-foreground">
            A business can read its own rows. Row level security is what enforces that, not the screen.
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium">Roles with a real boundary</dt>
          <dd className="mt-2 text-sm leading-6 text-muted-foreground">
            Platform admins, owners, and employees each have a different grant. Suspension blocks writes.
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium">Stamps, points, and one ledger</dt>
          <dd className="mt-2 text-sm leading-6 text-muted-foreground">
            Customers enroll with their own card. Staff record visits. A stamp QR and an NFC tag open the same link.
          </dd>
        </div>
      </dl>
    </main>
  );
}
