import { headers } from "next/headers";

export async function publicOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Origin printed on QR destination stickers. Falls back to the app origin. */
export async function qrPublicOrigin() {
  const configured = process.env.NEXT_PUBLIC_QR_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return publicOrigin();
}

export async function rateBucket(scope: string) {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerStore.get("x-real-ip") || "local";
  return `${scope}:${ip}`.slice(0, 160);
}
