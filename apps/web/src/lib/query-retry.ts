/**
 * Shared React Query retry policy tuned for a free-tier backend that cold-starts.
 *
 * The SabiScore backend runs on Render's free tier, which spins the service down
 * when idle and takes ~30-60s to cold-start. During that window every proxy call
 * returns 503 (see `APIError` code "COLD_START" in `lib/api.ts`). We want two
 * things that a plain `retry: N` number can't express:
 *
 *   1. Client errors (4xx, except 408 timeout) are permanent — never retry them.
 *   2. Cold-start / network / 5xx get a few spaced-out retries so the dashboard
 *      self-heals once the backend wakes, WITHOUT tight-looping on a backend that
 *      is genuinely down (suspended) and spamming the console + burning quota.
 *
 * Wire these into the QueryClient default so every query inherits the behaviour
 * instead of each component hardcoding its own `retry:` number.
 */

const COLD_START_CODES = new Set(["COLD_START", "NETWORK_ERROR", "TIMEOUT"]);
const MAX_RETRIES = 3;

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * True when the error looks like the backend is unreachable or waking up
 * (cold-start, network failure, timeout, or a 503/0 status) rather than a
 * permanent client-side error. Callers can use this to render a calm
 * "warming up" state instead of a hard error.
 */
export function isBackendUnavailable(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === 503 || status === 502 || status === 504 || status === 408 || status === 0) {
    return true;
  }
  const code = errorCode(error);
  return code !== undefined && COLD_START_CODES.has(code);
}

/**
 * React Query `retry` predicate. Never retries permanent 4xx client errors;
 * gives cold-start / 5xx / network failures a bounded number of attempts.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = errorStatus(error);
  // 4xx are permanent client errors — retrying can't fix them. 408 (request
  // timeout) is the one exception: it maps to a cold-start stall, so allow it.
  if (status !== undefined && status >= 400 && status < 500 && status !== 408) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

/**
 * Capped exponential backoff: 2s, 4s, 8s, then held at 12s. Spreads the three
 * retries across ~14s so a Render free-tier spin-up has time to complete, while
 * the 12s ceiling keeps a live-but-slow backend responsive. Deliberately NOT
 * React Query's default exponential-to-30s, which feels stuck to users.
 */
export function queryRetryDelay(attemptIndex: number): number {
  return Math.min(2000 * 2 ** attemptIndex, 12000);
}
