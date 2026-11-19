import assert from "node:assert/strict";
import { test } from "node:test";
import { isNextRedirect } from "./errors.ts";

test("isNextRedirect recognizes digest and message forms", () => {
  assert.equal(isNextRedirect({ digest: "NEXT_REDIRECT;replace;/admin;303;" }), true);
  assert.equal(isNextRedirect(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT" })), true);
  assert.equal(isNextRedirect(new Error("NEXT_REDIRECT")), true);
  assert.equal(isNextRedirect(new Error("permission denied to set role")), false);
  assert.equal(isNextRedirect(null), false);
});
