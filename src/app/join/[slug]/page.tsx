import { customerCopy, customerLocale } from "@/domain/customer-copy";
import { EnrollForm } from "@/components/enroll-form";
import { PublicBanner } from "@/components/public-banner";
import { getEnrollmentProfile } from "@/server/loyalty";

export const metadata = { title: "Join" };

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getEnrollmentProfile(slug);
  const locale = customerLocale(profile?.locale);
  const copy = customerCopy(locale);

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
        <h1 className="font-heading text-4xl">{copy.missing}</h1>
      </main>
    );
  }

  return (
    <PublicBanner
      name={profile.name}
      eyebrow={copy.joinEyebrow}
      logoUrl={profile.logoUrl}
      brandColor={profile.brandColor}
      brandColorSecondary={profile.brandColorSecondary}
    >
      <div lang={locale} className="grid gap-5">
        {profile.enrollmentOpen && profile.program ? (
          <>
            <div>
              <h2 className="font-heading text-2xl">{profile.program.name}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.joinIntro}</p>
              <p className="mt-3 text-sm leading-6">
                {profile.program.type === "stamps"
                  ? locale === "es"
                    ? `${profile.program.stampsRequired ?? 0} sellos completan la tarjeta.`
                    : `${profile.program.stampsRequired ?? 0} stamps complete the card.`
                  : locale === "es"
                    ? `${profile.program.pointsPerCurrencyUnit ?? 0} puntos por cada ${profile.program.currency}.`
                    : `${profile.program.pointsPerCurrencyUnit ?? 0} points for each ${profile.program.currency}.`}
              </p>
              {profile.program.terms ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{profile.program.terms}</p> : null}
            </div>
            <EnrollForm slug={profile.slug} locale={locale} copy={copy} />
          </>
        ) : (
          <p className="text-sm leading-6">{copy.closed}</p>
        )}
      </div>
    </PublicBanner>
  );
}
