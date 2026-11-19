import Link from "next/link";
import { notFound } from "next/navigation";
import { EditDestinationForm } from "@/components/destination-forms";
import { QrCode } from "@/components/qr-code";
import { DESTINATION_TYPE_LABELS, destinationStatusLabel } from "@/domain/qr-redirect";
import { qrPublicOrigin } from "@/lib/public-request";
import { listBusinesses } from "@/server/queries";
import { getQrRedirect } from "@/server/qr-redirects";
import { requireAdmin } from "@/server/workspace";

export const metadata = { title: "Edit QR destination" };

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireAdmin();
  const [destination, businesses, origin] = await Promise.all([
    getQrRedirect(userId, id),
    listBusinesses(userId),
    qrPublicOrigin(),
  ]);

  if (!destination) {
    notFound();
  }

  const permanentUrl = `${origin}/go/${destination.code}`;
  const businessOptions = businesses.map((business) => ({
    value: business.id,
    label: business.name,
  }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="grid gap-6">
        <div>
          <h2 className="font-heading text-3xl">{destination.businessName}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {DESTINATION_TYPE_LABELS[destination.destinationType]} · {destinationStatusLabel(destination.status)}
          </p>
          <p className="mt-3 break-all text-sm">Permanent QR URL: {permanentUrl}</p>
          <a href={permanentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">
            Test destination
          </a>
        </div>
        <EditDestinationForm
          id={destination.id}
          businessName={destination.businessName}
          businessId={destination.businessId}
          destinationType={destination.destinationType}
          destinationUrl={destination.destinationUrl}
          status={destination.status}
          businessOptions={businessOptions}
        />
        <Link href="/admin/destinations" className="text-sm underline">
          Back to destinations
        </Link>
      </div>
      <div className="grid gap-3">
        <QrCode value={permanentUrl} label={`QR for ${destination.businessName}`} />
        <p className="text-sm leading-6 text-muted-foreground">
          {destination.destinationUrl
            ? "Print this QR. Customers land directly on the destination URL."
            : "Print this QR now. Until a destination is set, scanners open the iAGO home page."}
        </p>
      </div>
    </div>
  );
}
