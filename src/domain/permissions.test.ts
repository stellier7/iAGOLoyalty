import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission } from "./permissions.ts";

test("owners and admins have every business permission", () => {
  assert.equal(hasPermission("owner", {}, "manage_settings"), true);
  assert.equal(hasPermission("admin", {}, "manage_team"), true);
});

test("employees receive only the permissions stored for them", () => {
  assert.equal(
    hasPermission("employee", { scan: true, redeem: false }, "scan"),
    true,
  );
  assert.equal(
    hasPermission("employee", { scan: true }, "redeem"),
    false,
  );
});

test("unknown roles have no permissions", () => {
  assert.equal(hasPermission("customer", { scan: true }, "scan"), false);
});
