import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel builds the Next.js app instead of publishing the public folder", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    framework?: string | null;
    buildCommand?: string;
    outputDirectory?: string | null;
  };

  assert.equal(config.framework, "nextjs");
  assert.equal(config.buildCommand, "next build && node scripts/migrate.mjs");
  assert.equal(config.outputDirectory, null);
});
