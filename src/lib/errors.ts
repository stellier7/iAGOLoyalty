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
  already_enrolled: "That email already has a card at this business.",
  program_not_accepted: "Program acceptance is required.",
  program_unavailable: "Create an active primary program first.",
  enrollment_closed: "Enrollment is closed for this business.",
  invalid_program: "Check the program rules and try again.",
  invalid_reward: "Check the reward and try again.",
  invalid_amount: "Enter an amount greater than zero.",
  below_minimum: "That purchase is below the program minimum.",
  wrong_program: "That action does not match this customer's program.",
  duplicate_scan: "That looks like a second entry a few seconds after the last one. Confirm it if this is another visit.",
  insufficient_balance: "The balance is not enough for that reward.",
  reward_unavailable: "That reward is not available to redeem.",
  manual_stamps_disabled: "Manual stamps are turned off for this program.",
  stamp_code_invalid: "That stamp code does not match this card.",
  stamp_code_used: "That rotating stamp code was already used.",
  stamp_code_expired: "That rotating stamp code has expired.",
  stamp_cooldown: "That stamp code was used recently for this card.",
  invalid_stamp_code: "Choose a static or rotating stamp code.",
  invalid_color: "Use a color like #1F4D3A.",
  invalid_logo: "The logo must be an https URL.",
  invalid_idempotency: "Refresh the page and try that again.",
  invalid_phone: "Enter a valid phone number.",
  invalid_birthday: "Enter a valid birthday.",
  invalid_transaction: "That ledger entry is not valid.",
  invalid_source: "That stamp source is not valid.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
  duplicate_reference: "That external reference was already posted.",
  ledger_immutable: "Ledger entries cannot be edited.",
  balance_locked: "Balances can only change through the ledger.",
  invalid_destination_url: "Enter a valid http or https destination URL.",
  invalid_destination_type: "Choose a destination type.",
  invalid_google_review_url: "Paste a Google Maps or Google review link.",
  invalid_whatsapp_url: "Paste a WhatsApp link such as https://wa.me/...",
  invalid_instagram_url: "Paste an Instagram profile or post URL.",
  invalid_qr_code: "Use letters and numbers only for the permanent QR code.",
  qr_code_taken: "That permanent QR code is already in use.",
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
  if (message.includes("SESSION_SECRET must be at least 32")) {
    return "SESSION_SECRET must be at least 32 characters in Vercel env vars.";
  }
  if (/relation .* does not exist/i.test(message) || /schema "auth" does not exist/i.test(message)) {
    return "Database tables are missing. Redeploy the app so migrations can run, then try setup again.";
  }
  if (/password authentication failed|ECONNREFUSED|ENOTFOUND|getaddrinfo|timeout|SSL/i.test(message)) {
    return "Could not connect to the database. Check POSTGRES_URL / DATABASE_URL in Vercel.";
  }

  return "Something went wrong. Try again.";
}
