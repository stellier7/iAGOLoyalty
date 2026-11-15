import assert from "node:assert/strict";
import test from "node:test";
import { hexColor, membershipTokenFromInput } from "./card-token.ts";

test("membershipTokenFromInput reads a card URL and a bare token", () => {
  const token = "abcDEF123_-tokenValue1234";
  assert.equal(membershipTokenFromInput(`https://loyalty.example/c/${token}`), token);
  assert.equal(membershipTokenFromInput(`https://loyalty.example/c/${token}?x=1`), token);
  assert.equal(membershipTokenFromInput(token), token);
  assert.equal(membershipTokenFromInput("https://loyalty.example/join/cafe"), null);
  assert.equal(membershipTokenFromInput("short"), null);
});

test("hexColor accepts only a six-digit color", () => {
  assert.equal(hexColor("#1F4D3A", "#000000"), "#1F4D3A");
  assert.equal(hexColor("green", "#000000"), "#000000");
  assert.equal(hexColor(null, "#112233"), "#112233");
});
