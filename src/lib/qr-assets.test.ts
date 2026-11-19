import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isQrAssetUrl, qrDownloadFileName, qrPngBuffer, qrSvgMarkup } from "./qr-assets.ts";

describe("qr download assets", () => {
  test("builds safe download filenames from permanent codes", () => {
    assert.equal(qrDownloadFileName("001", "png"), "qr-001.png");
    assert.equal(qrDownloadFileName("QR/10", "svg"), "qr-QR10.svg");
  });

  test("rejects non-http values", () => {
    assert.equal(isQrAssetUrl("javascript:alert(1)"), false);
    assert.equal(isQrAssetUrl("https://qr.iagodigital.com/go/001"), true);
  });

  test("renders png and svg for a permanent QR URL", async () => {
    const value = "https://qr.iagodigital.com/go/002";
    const png = await qrPngBuffer(value, 128);
    const svg = await qrSvgMarkup(value, 128);
    assert.ok(png.length > 100);
    assert.match(svg, /<svg[\s\S]*<\/svg>/i);
  });
});
