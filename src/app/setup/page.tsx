import { AuthShell } from "@/components/auth-shell";
import { ResetAdminPasswordForm, SetupForm } from "@/components/credential-forms";
import { getDataMode } from "@/lib/config";
import { platformHasSuperAdmin } from "@/server/accounts";

export const metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const mode = getDataMode();
  const hasAdmin = mode === "unconfigured" ? null : await platformHasSuperAdmin();

  if (hasAdmin) {
    return (
      <AuthShell
        title="Reset admin password"
        description="A platform admin already exists. Use the SETUP_TOKEN from Vercel to set a new password, then sign in."
      >
        <ResetAdminPasswordForm />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create the platform admin"
      description="This page closes after the first super admin exists. The setup token stays in the server environment and is never stored in the database."
    >
      {mode === "unconfigured" ? (
        <p className="text-sm leading-6 text-mute">
          The database is not configured. In Vercel, set <code className="text-ink">SESSION_SECRET</code>{" "}
          (32+ characters) and connect Neon so <code className="text-ink">POSTGRES_URL</code> or{" "}
          <code className="text-ink">DATABASE_URL</code> is present, then redeploy.
        </p>
      ) : hasAdmin === null ? (
        <p className="text-sm leading-6 text-mute">
          The app can see database settings, but it could not read the database. Open the latest Vercel
          deployment build log and confirm lines like <code className="text-ink">migrate: applied …</code>{" "}
          appear. Then redeploy and return here.
        </p>
      ) : (
        <SetupForm />
      )}
    </AuthShell>
  );
}
