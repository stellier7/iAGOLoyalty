"use client";

import { useActionState, useEffect } from "react";
import { acceptInvitationAction, loginAction, setupAction } from "@/server/actions";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/fields";
import type { ActionState } from "@/server/types";

function useHardRedirect(redirectTo?: string) {
  useEffect(() => {
    if (!redirectTo) {
      return;
    }
    // Full document navigation avoids Safari crashes on Next server-action redirects.
    window.location.assign(redirectTo);
  }, [redirectTo]);
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, action] = useActionState(loginAction, {} as ActionState);
  useHardRedirect(state.redirectTo);
  return (
    <form action={action} className="grid gap-4">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      <FormError message={state.error} />
      {state.redirectTo ? (
        <p className="text-sm text-mute">Signed in — opening your workspace…</p>
      ) : null}
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function SetupForm() {
  const [state, action] = useActionState(setupAction, {} as ActionState);
  useHardRedirect(state.redirectTo);
  return (
    <form action={action} className="grid gap-4">
      <TextField label="Setup token" name="setupToken" type="password" autoComplete="off" required />
      <TextField label="Your name" name="fullName" autoComplete="name" required />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue="iagodigitalweb@gmail.com"
        required
      />
      <TextField label="Password" name="password" type="password" autoComplete="new-password" required />
      <p className="text-sm text-muted-foreground">Use at least 10 characters.</p>
      <FormError message={state.error} />
      {state.redirectTo ? (
        <p className="text-sm text-mute">Admin created — opening the dashboard…</p>
      ) : null}
      <SubmitButton pendingLabel="Creating admin…">Create super admin</SubmitButton>
    </form>
  );
}

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInvitationAction, {} as ActionState);
  useHardRedirect(state.redirectTo);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted-foreground">
        This invitation is for <span className="text-foreground">{email}</span>.
      </p>
      <TextField label="Your name" name="fullName" autoComplete="name" required />
      <TextField label="Password" name="password" type="password" autoComplete="new-password" required />
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Joining…">Create account and join</SubmitButton>
    </form>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
