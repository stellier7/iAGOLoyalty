import QRCode from "qrcode";

const HTTP_URL = /^https?:\/\/\S+$/;

export function isQrAssetUrl(value: string): boolean {
  return HTTP_URL.test(value);
}

export function qrDownloadFileName(code: string, extension: "png" | "svg"): string {
  const safe = code.replace(/[^0-9A-Za-z_-]/g, "").slice(0, 32) || "code";
  return `qr-${safe}.${extension}`;
}

export async function qrSvgMarkup(value: string, width = 1024): Promise<string> {
  if (!isQrAssetUrl(value)) {
    throw new Error("iago:invalid_qr_value");
  }
  return QRCode.toString(value, {
    type: "svg",
    margin: 1,
    width,
    errorCorrectionLevel: "M",
  });
}

export async function qrPngBuffer(value: string, width = 1024): Promise<Buffer> {
  if (!isQrAssetUrl(value)) {
    throw new Error("iago:invalid_qr_value");
  }
  return QRCode.toBuffer(value, {
    type: "png",
    margin: 1,
    width,
    errorCorrectionLevel: "M",
  });
}
