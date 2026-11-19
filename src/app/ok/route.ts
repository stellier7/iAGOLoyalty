import { connection, NextResponse } from "next/server";
import {
  describeAuthConfig,
  getDataMode,
  hasDedicatedUnpooledDatabaseUrl,
  sessionSecretValue,
} from "@/lib/config";
import { withUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Plain-text health check for Safari / env debugging. Never prints secret values. */
export async function GET() {
  await connection();

  const mode = getDataMode();
  const auth = describeAuthConfig(mode);
  const secretLen = sessionSecretValue().length;

  let roleCheck = "skipped";
  if (mode === "hosted" || mode === "local") {
    try {
      await withUser("00000000-0000-4000-8000-000000000000", async (tx) => {
        await tx`select 1`;
      });
      roleCheck = "ok";
    } catch (error) {
      roleCheck = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 180) : "failed";
    }
  }

  const body = [
    "ok",
    `vercel_env=${process.env["VERCEL_ENV"] ?? "unknown"}`,
    `mode=${mode}`,
    `database=${auth.hasDatabaseUrl ? "yes" : "no"}`,
    `database_unpooled=${hasDedicatedUnpooledDatabaseUrl() ? "yes" : "no"}`,
    `session_secret=${auth.sessionSecretLongEnough ? "yes" : auth.hasSessionSecret ? "too_short" : "no"}`,
    `session_secret_len=${secretLen}`,
    `db_role_switch=${roleCheck}`,
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
