"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="iago-auth-shell relative min-h-screen">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
        <p className="text-xs font-semibold tracking-[0.28em] text-coral uppercase">iAGO Loyalty</p>
        <h1 className="mt-5 font-heading text-4xl font-extrabold tracking-tightest text-ink">
          Something broke
        </h1>
        <p className="mt-3 text-sm leading-6 text-mute">
          The page hit a server error. You should see this message instead of a black crash screen.
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
              Try again
            </button>
            <a href="/login" className="rounded-full border border-ink/20 px-5 py-2 text-sm text-ink">
              Sign in
            </a>
            <a href="/ok" className="px-2 py-2 text-sm text-mute underline">
              /ok
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
