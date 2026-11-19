"use client";

import { useActionState, useEffect } from "react";
import { acceptInvitationAction, setupAction, resetAdminPasswordAction } from "@/server/actions";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/fields";
import type { ActionState } from "@/server/types";

function useHardRedirect(redirectTo?: string) {
  useEffect(() => {
    if (!redirectTo) {
      return;
    }
    window.location.assign(redirectTo);
  }, [redirectTo]);
}

/** Classic POST — no React server actions (Safari-safe). */
export function LoginForm({
  nextPath,
  errorMessage,
}: {
  nextPath?: string;
  errorMessage?: string;
}) {
  return (
    <form action="/login/submit" method="post" className="grid gap-4">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue="iagodigitalweb@gmail.com"
        required
      />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      <FormError message={errorMessage} />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="text-sm text-mute">
        Forgot the password? Reset it on{" "}
        <a className="underline text-ink" href="/setup">
          /setup
        </a>{" "}
        with your SETUP_TOKEN.
      </p>
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

export function ResetAdminPasswordForm() {
  const [state, action] = useActionState(resetAdminPasswordAction, {} as ActionState);
  useHardRedirect(state.redirectTo);
  return (
    <form action={action} className="grid gap-4">
      <TextField label="Setup token" name="setupToken" type="password" autoComplete="off" required />
      <TextField
        label="Admin email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue="iagodigitalweb@gmail.com"
        required
      />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required />
      <p className="text-sm text-muted-foreground">Use at least 10 characters. This updates the existing super admin.</p>
      <FormError message={state.error} />
      {state.redirectTo ? (
        <p className="text-sm text-mute">Password updated — opening sign in…</p>
      ) : null}
      <SubmitButton pendingLabel="Updating password…">Reset admin password</SubmitButton>
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
