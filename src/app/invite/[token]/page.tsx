import Link from "next/link";
import { AcceptInviteForm } from "@/components/credential-forms";
import { previewInvitation } from "@/server/queries";
import { roleLabel } from "@/domain/labels";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewInvitation(token);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-heading text-3xl">
        iAGO Loyalty
      </Link>
      {preview.state === "pending" ? (
        <>
          <h1 className="mt-8 font-heading text-4xl">Join {preview.businessName}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            You are invited as {roleLabel(preview.role).toLowerCase()}. Create a password for this membership.
          </p>
          <div className="mt-8">
            <AcceptInviteForm token={token} email={preview.email} />
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-8 font-heading text-4xl">Invitation unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {preview.state === "used"
              ? "This invitation was already accepted."
              : preview.state === "expired"
                ? "This invitation has expired. Ask the business to send a new one."
                : "This invitation link is not valid."}
          </p>
          <Link href="/login" className="mt-6 text-sm underline">
            Sign in
          </Link>
        </>
      )}
    </main>
  );
}
