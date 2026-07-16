import { describe, expect, it, beforeEach } from "vitest";
import { withRetry } from "@/lib/retry";
import { rateLimit, _resetRateLimiters, withRateLimit } from "@/lib/rate-limit";

describe("withRetry", () => {
  it("succeeds without retry", async () => {
    const result = await withRetry(async () => 42);
    expect(result).toBe(42);
  });

  it("retries then succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          const err = new Error("temp");
          (err as Error & { status: number }).status = 500;
          throw err;
        }
        return "ok";
      },
      { retries: 3, minDelayMs: 1, maxDelayMs: 5 },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});

describe("rateLimit", () => {
  beforeEach(() => {
    _resetRateLimiters();
  });

  it("allows up to limit then blocks", async () => {
    const key = "gmail:test";
    for (let i = 0; i < 40; i++) {
      const r = await rateLimit(key, { limit: 40, windowMs: 60_000 });
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimit(key, { limit: 40, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
  });

  it("withRateLimit throws 429 when exhausted", async () => {
    const key = "slack:x";
    await withRateLimit(key, async () => 1, { limit: 1, windowMs: 60_000 });
    await expect(
      withRateLimit(key, async () => 2, { limit: 1, windowMs: 60_000 }),
    ).rejects.toMatchObject({ status: 429 });
  });
});
