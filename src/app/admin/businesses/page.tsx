import Link from "next/link";
import { businessStatusLabel } from "@/domain/labels";
import { listBusinesses } from "@/server/queries";
import { requireAdmin } from "@/server/workspace";

export const metadata = { title: "Businesses" };

export default async function BusinessesPage() {
  const { userId } = await requireAdmin();
  const businesses = await listBusinesses(userId);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-heading text-3xl">Businesses</h2>
        <Link href="/admin/businesses/new" className="text-sm underline">
          New business
        </Link>
      </div>
      {businesses.length === 0 ? (
        <p className="mt-6 max-w-lg text-sm leading-6 text-muted-foreground">
          No businesses yet. The first one can be Perfumes y Belleza, created here as a normal tenant.
        </p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Slug</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Currency</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((business) => (
              <tr key={business.id} className="border-t">
                <td className="py-3">
                  <Link href={`/admin/businesses/${business.id}`} className="underline">
                    {business.name}
                  </Link>
                </td>
                <td className="py-3">{business.slug}</td>
                <td className="py-3">{businessStatusLabel(business.status)}</td>
                <td className="py-3">{business.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
