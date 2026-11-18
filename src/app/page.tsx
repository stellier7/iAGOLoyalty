import Link from "next/link";
import { redirect } from "next/navigation";
import { IagoMark } from "@/components/iago-mark";
import { buttonVariants } from "@/components/ui/button";
import { getDataMode } from "@/lib/config";
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
    <main className="iago-home-shell relative min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute -right-24 top-10 size-[28rem] rounded-full bg-coral/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 size-[22rem] rounded-full bg-ink/5 blur-3xl" />

      <div className="relative mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 py-10 md:py-14">
        <header className="flex items-center justify-between gap-4">
          <IagoMark href="/" size="md" />
          <Link
            href="/login"
            className={buttonVariants({
              className: "rounded-full bg-ink px-5 text-bone hover:bg-coral hover:text-bone",
            })}
          >
            Sign in
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 md:py-20">
          <p className="text-xs font-semibold tracking-[0.28em] text-coral uppercase">iAGO Digital</p>
          <h1 className="mt-5 max-w-3xl font-heading text-5xl font-extrabold tracking-tightest text-ink text-balance md:text-7xl">
            Loyalty that stays
            <span className="text-coral"> yours</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-mute">
            Multi-tenant stamp cards, points, and rewards for cafés, salons, shops, and Perfumes y
            Belleza — each business isolated, one platform.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/login"
              className={buttonVariants({
                className: "rounded-full bg-ink px-6 text-bone hover:bg-coral hover:text-bone",
              })}
            >
              Sign in
            </Link>
            {hasAdmin === false ? (
              <Link
                href="/setup"
                className={buttonVariants({
                  variant: "outline",
                  className: "rounded-full border-ink/15 bg-bone/50 text-ink hover:bg-ink hover:text-bone",
                })}
              >
                Create the first admin
              </Link>
            ) : null}
          </div>
          {mode === "unconfigured" ? (
            <p className="mt-8 max-w-xl text-sm leading-6 text-mute">
              Sign-in is not ready on this deployment yet. Set the database and session secret, then
              return here.
            </p>
          ) : null}
        </section>

        <section className="grid gap-8 border-t border-ink/10 py-10 md:grid-cols-3">
          <Feature
            title="Separate tenants"
            body="Every business keeps its own customers, team, and ledger. Row level security enforces the boundary."
          />
          <Feature
            title="Clear roles"
            body="Platform admins, owners, and employees each get a different grant. Suspension blocks writes."
          />
          <Feature
            title="One ledger"
            body="Stamps, points, and rewards post through the same append-only ledger — QR and NFC included."
          />
        </section>
      </div>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="font-heading text-xl font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-mute">{body}</p>
    </div>
  );
}
