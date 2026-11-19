import { NextResponse } from "next/server";
import { qrDownloadFileName, qrPngBuffer, qrSvgMarkup } from "@/lib/qr-assets";
import { qrPublicOrigin } from "@/lib/public-request";
import { currentUserId } from "@/server/current-user";
import { getProfile } from "@/server/queries";
import { getQrRedirect } from "@/server/qr-redirects";

export const dynamic = "force-dynamic";

async function requireAdminUserId(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) {
    return null;
  }
  const profile = await getProfile(userId);
  if (!profile || profile.platformRole !== "super_admin") {
    return null;
  }
  return userId;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await requireAdminUserId();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const destination = await getQrRedirect(userId, id);
  if (!destination) {
    return new NextResponse("Not found", { status: 404 });
  }

  const format = new URL(request.url).searchParams.get("format")?.toLowerCase() ?? "png";
  if (format !== "png" && format !== "svg") {
    return new NextResponse("Use format=png or format=svg", { status: 400 });
  }

  const origin = await qrPublicOrigin();
  const value = `${origin}/go/${destination.code}`;
  const fileName = qrDownloadFileName(destination.code, format);

  try {
    if (format === "svg") {
      const svg = await qrSvgMarkup(value);
      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const png = await qrPngBuffer(value);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Could not build QR file", { status: 500 });
  }
}
