import { NextResponse, type NextRequest } from "next/server";
import { CARD_COOKIE, isCardToken } from "@/domain/card-token";
import { accountMode, getDataMode } from "@/lib/config";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

function rememberCard(request: NextRequest, response: NextResponse) {
  const match = request.nextUrl.pathname.match(/^\/c\/([A-Za-z0-9_-]{20,})$/);
  if (!match?.[1] || !isCardToken(match[1])) {
    return response;
  }
  response.cookies.set(CARD_COOKIE, match[1], {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const mode = getDataMode();
  const { pathname } = request.nextUrl;
  const protectedPath = pathname.startsWith("/app") || pathname.startsWith("/admin");

  if (mode === "supabase") {
    return rememberCard(request, await updateSupabaseSession(request));
  }

  if (accountMode(mode) === "database" && protectedPath && !request.cookies.get("iago_session")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return rememberCard(request, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
