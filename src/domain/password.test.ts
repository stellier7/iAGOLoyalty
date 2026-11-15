import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password.ts";

test("verifyPassword accepts the original password and rejects a different one", async () => {
  const hash = await hashPassword("correct-horse");
  assert.equal(await verifyPassword("correct-horse", hash), true);
  assert.equal(await verifyPassword("wrong-horse", hash), false);
});

test("hashPassword refuses a short password", async () => {
  await assert.rejects(() => hashPassword("short"), /10/);
});
