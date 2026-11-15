import { isCardToken } from "@/domain/card-token";
import { customerCopy, customerLocale } from "@/domain/customer-copy";
import { PublicBanner, StampMarks } from "@/components/public-banner";
import { QrCode } from "@/components/qr-code";
import { rateBucket, publicOrigin } from "@/lib/public-request";
import { getMembershipCard } from "@/server/loyalty";

export const metadata = { title: "Card" };

export default async function CardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = isCardToken(token) ? await getMembershipCard(token, await rateBucket("card")) : null;
  const locale = customerLocale(card?.locale);
  const copy = customerCopy(locale);
  if (!card) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
        <h1 className="font-heading text-4xl">{copy.cardMissing}</h1>
      </main>
    );
  }
  const origin = await publicOrigin();
  const cardUrl = `${origin}/c/${token}`;

  return (
    <PublicBanner
      name={card.businessName}
      eyebrow={card.programName}
      logoUrl={card.logoUrl}
      brandColor={card.brandColor}
      brandColorSecondary={card.brandColorSecondary}
    >
      <div lang={locale} className="grid gap-6">
        <div>
          <p className="text-sm text-muted-foreground">{copy.membership}</p>
          <p className="font-heading text-2xl">{card.membershipNumber}</p>
          <p className="mt-1 text-sm">{card.firstName} {card.lastName}</p>
        </div>
        {card.programType === "stamps" && card.stampsRequired ? (
          <div>
            <p className="text-sm text-muted-foreground">{copy.stamps}</p>
            <StampMarks balance={card.stampsBalance} required={card.stampsRequired} />
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">{copy.points}</p>
            <p className="font-heading text-4xl">{card.pointsBalance}</p>
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">{copy.rewards}</p>
          {card.rewards.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-sm">
              {card.rewards.map((reward) => (
                <li key={reward}>{reward}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm">{copy.noRewards}</p>
          )}
        </div>
        <div>
          <QrCode value={cardUrl} label={copy.showQr} />
          <p className="mt-3 text-sm text-muted-foreground">{copy.showQr}</p>
        </div>
      </div>
    </PublicBanner>
  );
}
