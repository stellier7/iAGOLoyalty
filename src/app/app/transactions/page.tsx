import { ledgerSourceLabel, ledgerTypeLabel } from "@/domain/loyalty-labels";
import { listTransactions } from "@/server/loyalty";
import { requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const workspace = await requireWorkspace();
  if (!workspace.business || !workspace.membership) {
    return <p className="text-sm">Join a business before viewing the ledger.</p>;
  }
  const entries = await listTransactions(workspace.userId, workspace.business.id);
  const timeZone = workspace.business.timezone;
  return (
    <div className="grid gap-4">
      <h2 className="font-heading text-3xl">Transactions</h2>
      <p className="text-sm text-muted-foreground">These rows are the ledger. Balances change only when a row is posted.</p>
      {entries.length === 0 ? <p className="text-sm text-muted-foreground">No transactions yet.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">When</th>
              <th className="py-2 font-medium">Customer</th>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Change</th>
              <th className="py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t">
                <td className="py-3 whitespace-nowrap">
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(entry.createdAt))}
                </td>
                <td className="py-3">{entry.customerName ?? entry.membershipNumber ?? "Card"}</td>
                <td className="py-3">{ledgerTypeLabel(entry.type)}</td>
                <td className="py-3">
                  {entry.stampsDelta !== 0 ? `${entry.stampsDelta > 0 ? "+" : ""}${entry.stampsDelta} stamps` : null}
                  {entry.pointsDelta !== 0 ? `${entry.pointsDelta > 0 ? "+" : ""}${entry.pointsDelta} points` : null}
                  {entry.stampsDelta === 0 && entry.pointsDelta === 0 ? "Redeemed" : null}
                  {entry.amount !== null ? ` · ${entry.amount} ${entry.currency ?? ""}` : null}
                </td>
                <td className="py-3">{ledgerSourceLabel(entry.source)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
