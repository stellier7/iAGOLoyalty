import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { readBusinessId, writeBusinessId } from "@/lib/session";
import { currentUserId } from "@/server/current-user";
import { getProfile, listMemberships } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function EnterPage() {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }

  try {
    const profile = await getProfile(userId);
    if (profile?.platformRole === "super_admin") {
      redirect("/admin");
    }

    const memberships = await listMemberships(userId);
    const requested = await readBusinessId();
    const chosen = memberships.find((membership) => membership.businessId === requested) ?? memberships[0];
    if (chosen) {
      await writeBusinessId(chosen.businessId);
      redirect("/app");
    }

    return (
      <AuthShell
        title="No workspace yet"
        description="You are signed in, but you are not a member of a business yet. Ask a platform admin to invite you."
      >
        <p className="text-sm text-mute">
          Signed in as {profile?.email ?? "your account"}.{" "}
          <Link className="underline text-ink" href="/login">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    return (
      <AuthShell
        title="Could not open your workspace"
        description="Sign-in worked, but loading your profile failed. This is usually a Neon database role / pooling issue."
      >
        <p className="rounded-lg border border-ink/10 bg-bone p-3 text-sm leading-6 text-ink">{detail}</p>
        <p className="mt-4 text-sm text-mute">
          Open <Link className="underline text-ink" href="/ok">/ok</Link> and check{" "}
          <code className="text-ink">db_role_switch</code>.
        </p>
      </AuthShell>
    );
  }
}
