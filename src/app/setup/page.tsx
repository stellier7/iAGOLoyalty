import Link from "next/link";
import { redirect } from "next/navigation";
import { getDataMode } from "@/lib/config";
import { SetupForm } from "@/components/credential-forms";
import { platformHasSuperAdmin } from "@/server/accounts";

export const metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const mode = getDataMode();
  const hasAdmin = mode === "unconfigured" ? null : await platformHasSuperAdmin();
  if (hasAdmin) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-heading text-3xl">
        iAGO Loyalty
      </Link>
      <h1 className="mt-8 font-heading text-4xl">Create the platform admin</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This page closes after the first super admin exists. The setup token stays in the server environment and is never stored in the database.
      </p>
      <div className="mt-8">
        {mode === "unconfigured" ? (
          <p className="text-sm leading-6">
            The database is not configured. In Vercel, set <code>SESSION_SECRET</code> (32+ characters) and connect Neon
            so <code>POSTGRES_URL</code> or <code>DATABASE_URL</code> is present, then redeploy.
          </p>
        ) : hasAdmin === null ? (
          <p className="text-sm leading-6">
            The app can see database settings, but it could not read the database. Open the latest Vercel deployment
            build log and confirm lines like <code>migrate: applied …</code> appear. Then redeploy and return here.
          </p>
        ) : (
          <SetupForm />
        )}
      </div>
    </main>
  );
}
