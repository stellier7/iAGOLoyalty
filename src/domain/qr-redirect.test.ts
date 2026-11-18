import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  isQrRedirectCode,
  parseDestinationUrl,
} from "./qr-redirect.ts";

describe("qr redirect destination URLs", () => {
  test("accepts https Google review URLs", () => {
    const url = parseDestinationUrl(
      "https://search.google.com/local/writereview?placeid=ChIJTest",
      "google_reviews",
    );
    assert.equal(url, "https://search.google.com/local/writereview?placeid=ChIJTest");
  });

  test("accepts maps.app.goo.gl review links", () => {
    const url = parseDestinationUrl("https://maps.app.goo.gl/abc123", "google_reviews");
    assert.equal(url, "https://maps.app.goo.gl/abc123");
  });

  test("rejects javascript destinations", () => {
    assert.throws(() => parseDestinationUrl("javascript:alert(1)", "custom"), /invalid_destination_url/);
  });

  test("rejects data URLs", () => {
    assert.throws(() => parseDestinationUrl("data:text/html,hi", "website"), /invalid_destination_url/);
  });

  test("rejects URLs with embedded credentials", () => {
    assert.throws(
      () => parseDestinationUrl("https://user:pass@example.com/path", "custom"),
      /invalid_destination_url/,
    );
  });

  test("rejects non-Google hosts for google_reviews", () => {
    assert.throws(
      () => parseDestinationUrl("https://evil.example/reviews", "google_reviews"),
      /invalid_google_review_url/,
    );
  });

  test("accepts WhatsApp and Instagram typed hosts", () => {
    assert.equal(parseDestinationUrl("https://wa.me/50499999999", "whatsapp"), "https://wa.me/50499999999");
    assert.equal(
      parseDestinationUrl("https://www.instagram.com/business/", "instagram"),
      "https://www.instagram.com/business/",
    );
  });

  test("accepts permanent QR codes like 001", () => {
    assert.equal(isQrRedirectCode("001"), true);
    assert.equal(isQrRedirectCode("abc"), true);
    assert.equal(isQrRedirectCode("../x"), false);
    assert.equal(isQrRedirectCode(""), false);
  });
});
