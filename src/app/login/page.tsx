import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/credential-forms";
import { currentProfile } from "@/server/current-user";

export const metadata = { title: "Sign in" };

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
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-heading text-3xl">
        iAGO Loyalty
      </Link>
      <h1 className="mt-8 font-heading text-4xl">Sign in</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Staff and platform admins sign in here. Customer loyalty cards are a separate, later flow.
      </p>
      <div className="mt-8">
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
