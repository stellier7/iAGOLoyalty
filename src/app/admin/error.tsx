"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="iago-auth-shell relative min-h-screen">
      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-xs font-semibold tracking-[0.28em] text-coral uppercase">Platform</p>
        <h1 className="mt-5 font-heading text-4xl font-extrabold tracking-tightest text-ink">
          Admin failed to load
        </h1>
        <p className="mt-3 text-sm leading-6 text-mute">
          Sign-in may have worked, but the dashboard threw an error. Details below — not a black
          screen.
        </p>
        <div className="mt-8 rounded-2xl border border-ink/10 bg-bone p-5">
          <p className="text-sm leading-6 text-ink break-words">{error.message || "Unknown error"}</p>
          {error.digest ? <p className="mt-2 text-xs text-mute">Digest: {error.digest}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full bg-ink px-5 py-2 text-sm text-bone"
            >
              Retry dashboard
            </button>
            <a href="/login" className="rounded-full border border-ink/20 px-5 py-2 text-sm text-ink">
              Sign in again
            </a>
            <a href="/ok" className="px-2 py-2 text-sm text-mute underline">
              Check /ok
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
