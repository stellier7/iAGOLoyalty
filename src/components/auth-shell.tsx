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
    <main className="iago-auth-shell relative min-h-screen">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
        <IagoMark href="/" size="md" />
        <h1 className="mt-10 font-heading text-4xl font-extrabold tracking-tightest text-ink text-balance">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-mute">{description}</p>
        <div className="mt-8 rounded-2xl border border-ink/10 bg-bone p-5">
          {children}
        </div>
      </div>
    </main>
  );
}
