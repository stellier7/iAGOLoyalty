import { rewardTypeLabel } from "@/domain/loyalty-labels";
import { RewardForm, StampRewardButton } from "@/components/loyalty-forms";
import { listPrograms, listRewards } from "@/server/loyalty";
import { canManageSettings, requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Rewards" };

export default async function RewardsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  if (!workspace.business || !workspace.membership || !canManageSettings(workspace.membership)) {
    return <p className="text-sm">Rewards are limited to owners, admins, and employees with settings permission.</p>;
  }
  const programs = await listPrograms(workspace.userId, workspace.business.id);
  const rewards = await listRewards(workspace.userId, workspace.business.id);
  const stampPrograms = programs.filter((program) => program.programType === "stamps");
  const active = workspace.business.status === "active";

  return (
    <div className="grid gap-10">
      {params.error ? <p className="text-sm text-destructive">{params.error}</p> : null}
      <section className="grid gap-3">
        <h2 className="font-heading text-3xl">Rewards</h2>
        {rewards.length === 0 ? <p className="text-sm text-muted-foreground">No rewards yet.</p> : null}
        {rewards.map((reward) => {
          const program = programs.find((item) => item.id === reward.programId);
          const selected = program?.stampRewardId === reward.id;
          return (
            <article key={reward.id} className="rounded-xl border px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{reward.name}</h3>
                <p className="text-sm text-muted-foreground">{rewardTypeLabel(reward.rewardType)}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {program?.name ?? "Program"} · {reward.pointsCost === null ? "Granted by the program" : `${reward.pointsCost} points`}
                {reward.inventoryLimit !== null ? ` · ${reward.redeemedCount} of ${reward.inventoryLimit} redeemed` : ""}
                {selected ? " · Stamp completion reward" : ""}
              </p>
              {active && program?.programType === "stamps" && !selected ? (
                <div className="mt-3">
                  <StampRewardButton programId={program.id} rewardId={reward.id} />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
      {active && programs.length > 0 ? (
        <section className="max-w-2xl">
          <h2 className="font-heading text-3xl">New reward</h2>
          <div className="mt-4">
            <RewardForm programs={programs} />
          </div>
          {stampPrograms.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Stamp completion rewards need a stamp program.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
