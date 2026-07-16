/**
 * Simple in-memory token-bucket rate limiter for external APIs.
 * In production, swap for Redis-backed limiter for multi-instance deploys.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in ms */
  windowMs: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  gmail: { limit: 40, windowMs: 60_000 },
  calendar: { limit: 40, windowMs: 60_000 },
  slack: { limit: 30, windowMs: 60_000 },
  github: { limit: 50, windowMs: 60_000 },
  notion: { limit: 25, windowMs: 60_000 },
  openai: { limit: 20, windowMs: 60_000 },
};

export function getRateLimitConfig(provider: string): RateLimitConfig {
  return DEFAULTS[provider] ?? { limit: 30, windowMs: 60_000 };
}

export async function rateLimit(
  key: string,
  config?: RateLimitConfig,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const cfg = config ?? getRateLimitConfig(key.split(":")[0] ?? key);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: cfg.limit, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed >= cfg.windowMs) {
    bucket.tokens = cfg.limit;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    const retryAfterMs = cfg.windowMs - elapsed;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  bucket.tokens -= 1;
  return { allowed: true, retryAfterMs: 0 };
}

export async function withRateLimit<T>(
  key: string,
  fn: () => Promise<T>,
  config?: RateLimitConfig,
): Promise<T> {
  const result = await rateLimit(key, config);
  if (!result.allowed) {
    const err = new Error(`Rate limited for ${key}; retry in ${result.retryAfterMs}ms`);
    (err as Error & { status: number }).status = 429;
    throw err;
  }
  return fn();
}

/** Test helper */
export function _resetRateLimiters(): void {
  buckets.clear();
}
