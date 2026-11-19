import Link from "next/link";
import { CreateDestinationForm } from "@/components/destination-forms";
import { listBusinesses } from "@/server/queries";
import { requireAdmin } from "@/server/workspace";

export const metadata = { title: "New QR destination" };

export default async function NewDestinationPage() {
  const { userId } = await requireAdmin();
  const businesses = await listBusinesses(userId);
  const businessOptions = businesses.map((business) => ({
    value: business.id,
    label: business.name,
  }));

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="font-heading text-3xl">New QR destination</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Create one or many permanent `/go/` codes. Leave the destination blank to print first; scanners go
          to the iAGO home page until you set Google.
        </p>
      </div>
      <CreateDestinationForm businessOptions={businessOptions} />
      <Link href="/admin/destinations" className="text-sm underline">
        Back to destinations
      </Link>
    </div>
  );
}
