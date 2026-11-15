import assert from "node:assert/strict";
import test from "node:test";
import { slugifyBusinessName } from "./slug.ts";

test("slugifyBusinessName lowercases and hyphenates a business name", () => {
  assert.equal(slugifyBusinessName("iAGO Perfumery"), "iago-perfumery");
});

test("slugifyBusinessName builds the Perfumes y Belleza tenant slug", () => {
  assert.equal(slugifyBusinessName("Perfumes y Belleza"), "perfumes-y-belleza");
});

test("slugifyBusinessName strips accents and punctuation", () => {
  assert.equal(slugifyBusinessName("Café Ñoño & Co."), "cafe-nono-co");
});

test("slugifyBusinessName rejects a name that cannot make a slug", () => {
  assert.throws(() => slugifyBusinessName("***"), /slug/);
});
