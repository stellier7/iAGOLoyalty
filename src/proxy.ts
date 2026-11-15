import { NextResponse, type NextRequest } from "next/server";
import { getDataMode } from "@/lib/config";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const mode = getDataMode();
  const { pathname } = request.nextUrl;
  const protectedPath = pathname.startsWith("/app") || pathname.startsWith("/admin");

  if (mode === "supabase") {
    return updateSupabaseSession(request);
  }

  if (mode === "local" && protectedPath && !request.cookies.get("iago_session")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
