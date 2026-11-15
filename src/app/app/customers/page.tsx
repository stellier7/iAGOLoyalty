import { hasPermission } from "@/domain/permissions";
import { listCustomers } from "@/server/loyalty";
import { requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const workspace = await requireWorkspace();
  if (!workspace.business || !workspace.membership) {
    return <p className="text-sm">Join a business before viewing customers.</p>;
  }
  if (!hasPermission(workspace.membership.role, workspace.membership.permissions, "view_customers")) {
    return <p className="text-sm">Customer records are limited to staff with customer permission.</p>;
  }
  const customers = await listCustomers(workspace.userId, workspace.business.id);
  return (
    <div className="grid gap-4">
      <h2 className="font-heading text-3xl">Customers</h2>
      {customers.length === 0 ? <p className="text-sm text-muted-foreground">No one has enrolled yet.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Customer</th>
              <th className="py-2 font-medium">Card</th>
              <th className="py-2 font-medium">Stamps</th>
              <th className="py-2 font-medium">Points</th>
              <th className="py-2 font-medium">Contact</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t">
                <td className="py-3">{customer.firstName} {customer.lastName}</td>
                <td className="py-3">{customer.membershipNumber}</td>
                <td className="py-3">{customer.stampsBalance}</td>
                <td className="py-3">{customer.pointsBalance}</td>
                <td className="py-3">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
