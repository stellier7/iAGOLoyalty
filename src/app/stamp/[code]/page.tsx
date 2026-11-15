import { isStampCode } from "@/domain/card-token";
import { customerCopy, customerLocale } from "@/domain/customer-copy";
import { readCardToken } from "@/lib/card-cookie";
import { PublicBanner } from "@/components/public-banner";
import { StampForm } from "@/components/stamp-form";
import { getStampPreview } from "@/server/loyalty";

export const metadata = { title: "Stamp" };

export default async function StampPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const via = query.via === "nfc" ? "nfc" : "qr";
  const preview = isStampCode(code) ? await getStampPreview(code) : null;
  const locale = customerLocale(preview?.locale);
  const copy = customerCopy(locale);
  const cardToken = await readCardToken();

  if (!preview) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
        <h1 className="font-heading text-4xl">{copy.stampClosed}</h1>
      </main>
    );
  }

  return (
    <PublicBanner
      name={preview.businessName}
      eyebrow={copy.stampTitle}
      logoUrl={preview.logoUrl}
      brandColor={preview.brandColor}
      brandColorSecondary={preview.brandColorSecondary}
    >
      <div lang={locale} className="grid gap-4">
        <h2 className="font-heading text-2xl">{preview.label ?? copy.stampLabel}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{copy.stampIntro}</p>
        {preview.usable && cardToken ? <StampForm code={code} via={via} locale={locale} copy={copy} /> : null}
        {!cardToken ? <p className="text-sm leading-6">{copy.stampNeedCard}</p> : null}
        {cardToken && !preview.usable ? <p className="text-sm leading-6">{copy.stampClosed}</p> : null}
      </div>
    </PublicBanner>
  );
}
