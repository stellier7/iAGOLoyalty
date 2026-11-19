import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/credential-forms";
import { describeAuthConfig, getDataMode } from "@/lib/config";
import { currentProfile } from "@/server/current-user";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const profile = await currentProfile();
  if (profile) {
    redirect("/enter");
  }
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : undefined;
  const mode = getDataMode();
  const auth = describeAuthConfig(mode);

  return (
    <AuthShell
      title="Sign in"
      description="Platform admins and business staff sign in here. Customers open the link on their card instead."
    >
      {mode === "unconfigured" ? (
        <p className="mb-4 rounded-lg border border-ink/10 bg-bone/70 p-3 text-sm leading-6 text-mute">
          Auth is not ready on this deployment.
          {auth.missing.length > 0 ? (
            <>
              {" "}
              Missing: <span className="text-ink">{auth.missing.join(", ")}</span>.
            </>
          ) : null}{" "}
          Neon can supply <code className="text-ink">POSTGRES_URL</code>; set{" "}
          <code className="text-ink">SESSION_SECRET</code> yourself (32+ characters) for Production,
          then redeploy.
        </p>
      ) : null}
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
