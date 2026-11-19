import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const SESSION_COOKIE = "iago_session";
const BUSINESS_COOKIE = "iago_business";

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 14,
};

function sessionKey() {
  const secret = (process.env["SESSION_SECRET"] ?? "").trim();
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(sessionKey());
}

export async function readSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function writeSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await signSession(userId), SESSION_COOKIE_OPTIONS);
}

/** Attach session cookie to a Route Handler redirect (Safari-safe classic POST). */
export async function attachSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE, await signSession(userId), SESSION_COOKIE_OPTIONS);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(BUSINESS_COOKIE);
}

export async function readBusinessId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(BUSINESS_COOKIE)?.value ?? null;
}

export async function writeBusinessId(businessId: string) {
  const cookieStore = await cookies();
  cookieStore.set(BUSINESS_COOKIE, businessId, SESSION_COOKIE_OPTIONS);
}

export function attachBusinessCookie(response: NextResponse, businessId: string) {
  response.cookies.set(BUSINESS_COOKIE, businessId, SESSION_COOKIE_OPTIONS);
}

export function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  if (value.startsWith("/app") || value.startsWith("/admin") || value.startsWith("/invite/")) {
    return value;
  }
  return null;
}
