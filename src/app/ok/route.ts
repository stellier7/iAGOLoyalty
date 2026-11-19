import { NextResponse } from "next/server";
import { describeAuthConfig, getDataMode } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Plain-text health check for Safari / network debugging. */
export async function GET() {
  const mode = getDataMode();
  const auth = describeAuthConfig(mode);
  const body = [
    "ok",
    `mode=${mode}`,
    `database=${auth.hasDatabaseUrl ? "yes" : "no"}`,
    `session_secret=${auth.sessionSecretLongEnough ? "yes" : auth.hasSessionSecret ? "too_short" : "no"}`,
    auth.missing.length ? `missing=${auth.missing.join("|")}` : "missing=none",
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
