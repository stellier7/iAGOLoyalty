import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/credential-forms";
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

  return (
    <AuthShell
      title="Sign in"
      description="Platform admins and business staff sign in here. Customers open the link on their card instead."
    >
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
