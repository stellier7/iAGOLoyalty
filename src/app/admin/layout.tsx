import Link from "next/link";
import { AppFrame } from "@/components/app-frame";
import { AuthShell } from "@/components/auth-shell";
import { requireAdmin } from "@/server/workspace";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const { profile } = await requireAdmin();
    return (
      <AppFrame
        area="Platform"
        heading="iAGO Loyalty"
        profileName={profile.fullName ?? profile.email ?? "Super admin"}
        items={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/businesses", label: "Businesses" },
          { href: "/admin/destinations", label: "QR destinations" },
          { href: "/admin/settings", label: "Settings" },
          { href: "/app", label: "Business app" },
        ]}
      >
        {children}
      </AppFrame>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown admin error";
    // Next redirect() throws; rethrow those.
    if (typeof error === "object" && error && "digest" in error) {
      const digest = String((error as { digest?: string }).digest ?? "");
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
    return (
      <AuthShell
        title="Admin failed to load"
        description="You are past sign-in, but the platform shell could not load. This should never be a black crash page."
      >
        <p className="text-sm leading-6 text-ink break-words">{message}</p>
        <p className="mt-4 text-sm text-mute">
          Check <Link className="underline text-ink" href="/ok">/ok</Link> for{" "}
          <code className="text-ink">db_role_switch</code>, then{" "}
          <Link className="underline text-ink" href="/login">
            sign in again
          </Link>
          .
        </p>
      </AuthShell>
    );
  }
}
