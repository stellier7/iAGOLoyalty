export const DESTINATION_TYPES = [
  "website",
  "google_reviews",
  "instagram",
  "whatsapp",
  "custom",
] as const;

export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const DESTINATION_STATUSES = ["active", "inactive"] as const;
export type DestinationStatus = (typeof DESTINATION_STATUSES)[number];

/** Used when a permanent QR has no destination URL yet. */
export const DEFAULT_QR_FALLBACK_URL = "https://iagodigital.com";

export const DESTINATION_TYPE_LABELS: Record<DestinationType, string> = {
  website: "Website",
  google_reviews: "Google Reviews",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  custom: "Custom URL",
};

const CODE_PATTERN = /^[0-9A-Za-z]{1,32}$/;

export function isQrRedirectCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

export function isDestinationType(value: string): value is DestinationType {
  return (DESTINATION_TYPES as readonly string[]).includes(value);
}

export function isDestinationStatus(value: string): value is DestinationStatus {
  return (DESTINATION_STATUSES as readonly string[]).includes(value);
}

function hostMatches(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowed.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function assertHttpUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    throw new Error("iago:invalid_destination_url");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("iago:invalid_destination_url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("iago:invalid_destination_url");
  }

  if (url.username || url.password) {
    throw new Error("iago:invalid_destination_url");
  }

  if (!url.hostname) {
    throw new Error("iago:invalid_destination_url");
  }

  return url;
}

export function parseDestinationUrl(
  raw: string,
  type: DestinationType = "custom",
): string | null {
  if (!raw.trim()) {
    return null;
  }

  const url = assertHttpUrl(raw);
  const href = url.toString();

  switch (type) {
    case "google_reviews": {
      // Accept common Google review / Maps share hosts.
      if (
        !(
          hostMatches(url.hostname, ["google.com", "google.com.hn", "goo.gl", "g.page"]) ||
          url.hostname === "maps.app.goo.gl" ||
          url.hostname.endsWith(".google.com")
        )
      ) {
        throw new Error("iago:invalid_google_review_url");
      }
      return href;
    }
    case "whatsapp": {
      if (!hostMatches(url.hostname, ["wa.me", "whatsapp.com", "api.whatsapp.com"])) {
        throw new Error("iago:invalid_whatsapp_url");
      }
      return href;
    }
    case "instagram": {
      if (!hostMatches(url.hostname, ["instagram.com"])) {
        throw new Error("iago:invalid_instagram_url");
      }
      return href;
    }
    case "website":
    case "custom":
      return href;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

export function destinationStatusLabel(status: DestinationStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
