import Link from "next/link";
import {
  DESTINATION_TYPE_LABELS,
  destinationStatusLabel,
} from "@/domain/qr-redirect";
import { publicOrigin } from "@/lib/public-request";
import { listQrRedirects } from "@/server/qr-redirects";
import { requireAdmin } from "@/server/workspace";

export const metadata = { title: "QR destinations" };

export default async function DestinationsPage() {
  const { userId } = await requireAdmin();
  const [destinations, origin] = await Promise.all([listQrRedirects(userId), publicOrigin()]);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl">QR destinations</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Each QR code keeps a permanent `/go/` URL. Update the Google Review link (or WhatsApp, Instagram,
            website, or custom URL) anytime without reprinting the code.
          </p>
        </div>
        <Link href="/admin/destinations/new" className="text-sm underline">
          New destination
        </Link>
      </div>

      {destinations.length === 0 ? (
        <p className="mt-6 max-w-lg text-sm leading-6 text-muted-foreground">
          No destinations yet. Create one, paste the Google Review URL, and print the permanent QR URL.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Business</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Destination URL</th>
                <th className="py-2 font-medium">Permanent QR URL</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {destinations.map((destination) => {
                const permanentUrl = `${origin}/go/${destination.code}`;
                return (
                  <tr key={destination.id} className="border-t align-top">
                    <td className="py-3 pr-3">{destination.businessName}</td>
                    <td className="py-3 pr-3">{DESTINATION_TYPE_LABELS[destination.destinationType]}</td>
                    <td className="max-w-[14rem] break-all py-3 pr-3 text-muted-foreground">
                      {destination.destinationUrl}
                    </td>
                    <td className="max-w-[12rem] break-all py-3 pr-3">{permanentUrl}</td>
                    <td className="py-3 pr-3">{destinationStatusLabel(destination.status)}</td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        <Link href={`/admin/destinations/${destination.id}`} className="underline">
                          Edit destination
                        </Link>
                        <a href={permanentUrl} target="_blank" rel="noreferrer" className="underline">
                          Test destination
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
