import Link from "next/link";
import { isStampCode } from "@/domain/card-token";
import { QrCode } from "@/components/qr-code";
import { publicOrigin } from "@/lib/public-request";
import { listStampCodes } from "@/server/loyalty";
import { requireWorkspace } from "@/server/workspace";
import { hasPermission } from "@/domain/permissions";

export const metadata = { title: "Stamp code" };

export default async function StampCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const workspace = await requireWorkspace();
  if (!workspace.business || !workspace.membership) {
    return <p className="text-sm">Join a business before opening a stamp code.</p>;
  }
  if (!hasPermission(workspace.membership.role, workspace.membership.permissions, "issue_stamps") || !isStampCode(code)) {
    return <p className="text-sm">That stamp code is not available.</p>;
  }
  const match = (await listStampCodes(workspace.userId, workspace.business.id)).find((item) => item.code === code);
  if (!match) {
    return <p className="text-sm">That stamp code is not available.</p>;
  }
  const origin = await publicOrigin();
  const qrUrl = `${origin}/stamp/${match.code}`;
  const nfcUrl = `${qrUrl}?via=nfc`;
  return (
    <div className="grid max-w-xl gap-6">
      <div>
        <h2 className="font-heading text-3xl">{match.label ?? "Stamp code"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {match.kind === "rotating" ? "Rotating code. It expires about 60 seconds after it was created and works once." : "Static location code."}
        </p>
      </div>
      <QrCode value={qrUrl} label={`Stamp QR for ${match.label ?? "this location"}`} />
      <div className="grid gap-2 text-sm">
        <p className="break-all">QR: {qrUrl}</p>
        <p className="break-all">NFC tag: {nfcUrl}</p>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Print or display the QR. For NFC, write the tag address with any NFC writer. iPhone and Android open that link without an app. The customer needs to have opened their card on that phone first.
      </p>
      <Link href="/app/programs" className="text-sm underline">
        Back to programs
      </Link>
    </div>
  );
}
