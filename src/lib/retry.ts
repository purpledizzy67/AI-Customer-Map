/**
 * Retry helper with exponential backoff for external API calls.
 */

export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_SHOULD_RETRY = (error: unknown): boolean => {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status: number }).status);
    return status === 429 || status >= 500;
  }
  if (error instanceof Error) {
    return /network|timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(error.message);
  }
  return false;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    minDelayMs = 400,
    maxDelayMs = 8000,
    shouldRetry = DEFAULT_SHOULD_RETRY,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      const delay = Math.min(maxDelayMs, minDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 120);
      await sleep(delay + jitter);
    }
  }
  throw lastError;
}
