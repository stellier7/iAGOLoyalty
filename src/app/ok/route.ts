import { connection, NextResponse } from "next/server";
import { describeAuthConfig, getDataMode, sessionSecretValue } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Plain-text health check for Safari / env debugging. Never prints secret values. */
export async function GET() {
  await connection();

  const mode = getDataMode();
  const auth = describeAuthConfig(mode);
  const secretLen = sessionSecretValue().length;
  const body = [
    "ok",
    `vercel_env=${process.env["VERCEL_ENV"] ?? "unknown"}`,
    `mode=${mode}`,
    `database=${auth.hasDatabaseUrl ? "yes" : "no"}`,
    `session_secret=${auth.sessionSecretLongEnough ? "yes" : auth.hasSessionSecret ? "too_short" : "no"}`,
    `session_secret_len=${secretLen}`,
    auth.missing.length ? `missing=${auth.missing.join("|")}` : "missing=none",
    "note=after changing Vercel env vars you must Redeploy",
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
