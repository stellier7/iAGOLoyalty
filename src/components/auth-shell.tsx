import { IagoMark } from "@/components/iago-mark";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="iago-auth-shell relative min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgb(232_115_74/0.12),transparent)]" />
      <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-6 py-16">
        <IagoMark href="/" size="md" />
        <h1 className="mt-10 font-heading text-4xl font-extrabold tracking-tightest text-ink text-balance">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-mute">{description}</p>
        <div className="mt-8 rounded-2xl border border-ink/8 bg-bone/70 p-5 shadow-[0_24px_60px_-40px_rgb(10_10_10/0.45)] backdrop-blur-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
