import { hexColor } from "@/domain/card-token";

export function PublicBanner({
  name,
  eyebrow,
  logoUrl,
  brandColor,
  brandColorSecondary,
  children,
}: {
  name: string;
  eyebrow: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandColorSecondary: string | null;
  children: React.ReactNode;
}) {
  const color = hexColor(brandColor, "#1F4D3A");
  const accent = hexColor(brandColorSecondary, "#C4A574");
  const logo = logoUrl && /^https:\/\/\S+$/.test(logoUrl) ? logoUrl : null;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 py-10">
      <header className="rounded-3xl border bg-card px-5 py-6" style={{ borderColor: color }}>
        <div className="flex items-center gap-3">
          {logo ? (
            // Tenant logos are arbitrary https URLs, so they cannot be pinned to a Next image host.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-12 rounded-full object-cover" />
          ) : null}
          <div>
            <p className="text-sm" style={{ color: accent }}>
              {eyebrow}
            </p>
            <h1 className="font-heading text-4xl leading-tight">{name}</h1>
          </div>
        </div>
      </header>
      <div className="mt-6">{children}</div>
    </main>
  );
}

export function StampMarks({ balance, required }: { balance: number; required: number }) {
  const shown = Math.min(required, 12);
  return (
    <div>
      <p className="font-heading text-3xl">
        {balance}
        <span className="text-lg text-muted-foreground"> / {required}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2" aria-hidden="true">
        {Array.from({ length: shown }, (_, index) => (
          <span
            key={index}
            className={index < Math.min(balance, shown) ? "size-4 rounded-full bg-primary" : "size-4 rounded-full border border-primary/40"}
          />
        ))}
      </div>
    </div>
  );
}
