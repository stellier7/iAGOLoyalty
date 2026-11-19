import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/credential-forms";
import { describeAuthConfig, getDataMode, unconfiguredAuthMessage } from "@/lib/config";
import { currentProfile } from "@/server/current-user";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

function loginErrorMessage(code: string | undefined): string | undefined {
  switch (code) {
    case undefined:
    case "":
      return undefined;
    case "credentials":
      return "Those credentials do not match an account.";
    case "invalid":
      return "Enter the email and password for your account.";
    case "unconfigured":
      return unconfiguredAuthMessage();
    case "supabase":
      return "This deployment expects Supabase Auth. Use the Supabase sign-in path.";
    case "server":
      return "Sign-in failed. Check the database connection and try again.";
    default:
      return "Sign-in failed. Try again.";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const profile = await currentProfile();
  if (profile) {
    redirect("/enter");
  }
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : undefined;
  const mode = getDataMode();
  const auth = describeAuthConfig(mode);
  const errorMessage = loginErrorMessage(params.error);

  return (
    <AuthShell
      title="Sign in"
      description="Platform admins and business staff sign in here. Customers open the link on their card instead."
    >
      {params.reset === "1" ? (
        <p className="mb-4 rounded-lg border border-ink/10 bg-bone p-3 text-sm leading-6 text-ink">
          Password updated. Sign in with the new password.
        </p>
      ) : null}
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
      <LoginForm nextPath={nextPath} errorMessage={errorMessage} />
    </AuthShell>
  );
}
