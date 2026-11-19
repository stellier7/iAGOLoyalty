import { NextResponse } from "next/server";
import { isQrRedirectCode, parseDestinationUrl } from "@/domain/qr-redirect";
import { resolveQrRedirect } from "@/server/qr-redirects";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: {
      ...NO_STORE,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function redirectTo(destination: string) {
  const response = NextResponse.redirect(destination, 307);
  for (const [key, value] of Object.entries(NO_STORE)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await context.params;
  const code = decodeURIComponent(rawCode).trim();
  if (!isQrRedirectCode(code)) {
    return notFound();
  }

  const resolved = await resolveQrRedirect(code);
  if (!resolved) {
    return notFound();
  }

  if (!resolved.destinationUrl || resolved.placeholder) {
    return redirectTo(new URL("/", request.url).toString());
  }

  let destination: string;
  try {
    const parsed = parseDestinationUrl(resolved.destinationUrl, resolved.destinationType);
    if (!parsed) {
      return redirectTo(new URL("/", request.url).toString());
    }
    destination = parsed;
  } catch {
    return notFound();
  }

  return redirectTo(destination);
}
