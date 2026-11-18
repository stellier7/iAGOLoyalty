import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hostedDatabaseUrl, hostedDatabaseUrlUnpooled } from "./config.ts";

describe("hosted database URL helpers", () => {
  test("prefers DATABASE_URL over Neon POSTGRES_URL", () => {
    const previous = {
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
    };

    process.env.DATABASE_URL = "postgres://app/primary";
    process.env.POSTGRES_URL = "postgres://neon/pooled";
    process.env.POSTGRES_PRISMA_URL = "postgres://neon/prisma";
    delete process.env.DATABASE_URL_UNPOOLED;
    process.env.POSTGRES_URL_NON_POOLING = "postgres://neon/direct";

    try {
      assert.equal(hostedDatabaseUrl(), "postgres://app/primary");
      assert.equal(hostedDatabaseUrlUnpooled(), "postgres://neon/direct");
    } finally {
      restore(previous);
    }
  });

  test("falls back to Neon names when DATABASE_URL is unset", () => {
    const previous = {
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
    };

    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
    process.env.POSTGRES_URL = "postgres://neon/pooled";
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;

    try {
      assert.equal(hostedDatabaseUrl(), "postgres://neon/pooled");
      assert.equal(hostedDatabaseUrlUnpooled(), "postgres://neon/pooled");
    } finally {
      restore(previous);
    }
  });
});

function restore(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
