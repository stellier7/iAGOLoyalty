const MESSAGES: Record<string, string> = {
  not_authorized: "You do not have permission to do that.",
  not_authenticated: "Sign in again to continue.",
  not_found: "That record is no longer available.",
  business_suspended: "This business is suspended. Changes are blocked until it is reactivated.",
  invalid_name: "Enter a name between 2 and 80 characters.",
  invalid_slug: "Use a lowercase slug with letters, numbers, and hyphens.",
  invalid_currency: "Choose a three-letter currency code.",
  invalid_locale: "Choose a valid language.",
  invalid_timezone: "Choose a valid time zone.",
  invalid_email: "Enter a valid email address.",
  invalid_role: "Choose an owner, admin, or employee role.",
  invalid_status: "Choose a valid business status.",
  invalid_setting: "That platform setting cannot be saved.",
  slug_taken: "That business slug is already in use.",
  invitation_invalid: "This invitation link is not valid.",
  invitation_used: "This invitation has already been used.",
  invitation_expired: "This invitation has expired.",
  invitation_email_mismatch: "Sign in with the email address that received the invitation.",
  last_owner: "A business must keep at least one active owner.",
  not_employee: "Permissions can only be edited for employees.",
};

export function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function toActionError(error: unknown): string {
  if (isNextRedirect(error)) {
    throw error;
  }

  const message = error instanceof Error ? error.message : "";
  const code = message.match(/iago:([a-z0-9_]+)/)?.[1];
  if (code && MESSAGES[code]) {
    return MESSAGES[code];
  }
  if (message.includes("business_invitations_one_pending_email")) {
    return "An invitation for that email is already pending.";
  }
  if (message.includes("profiles_email_key") || message.includes("users_email_key")) {
    return "An account with that email already exists.";
  }
  if (message.startsWith("Use at least 10")) {
    return message;
  }

  return "Something went wrong. Try again.";
}
