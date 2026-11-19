import { NextResponse } from "next/server";
import { accountMode } from "@/lib/config";
import { attachBusinessCookie, attachSessionCookie, safeNextPath } from "@/lib/session";
import { verifyLocalLogin } from "@/server/accounts";
import { getProfile, listMemberships } from "@/server/queries";

export const dynamic = "force-dynamic";

/**
 * Classic HTML form POST login.
 * Safari/WebKit often crashes on Next.js server-action redirect streams;
 * a 303 response is the reliable path.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));

  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, request.url), 303);

  if (!email.includes("@") || password.length < 10) {
    return fail("invalid");
  }

  const mode = accountMode();
  if (mode === "unconfigured") {
    return fail("unconfigured");
  }
  if (mode === "supabase") {
    return fail("supabase");
  }

  let userId: string | null = null;
  try {
    userId = await verifyLocalLogin(email, password);
  } catch {
    return fail("server");
  }
  if (!userId) {
    return fail("credentials");
  }

  let destination = nextPath ?? "/enter";
  let businessId: string | null = null;
  try {
    const profile = await getProfile(userId);
    if (profile?.platformRole === "super_admin") {
      destination = nextPath ?? "/admin";
    } else {
      const memberships = await listMemberships(userId);
      if (memberships[0]) {
        businessId = memberships[0].businessId;
        destination = nextPath ?? "/app";
      }
    }
  } catch {
    destination = nextPath ?? "/enter";
  }

  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  await attachSessionCookie(response, userId);
  if (businessId) {
    attachBusinessCookie(response, businessId);
  }
  return response;
}
