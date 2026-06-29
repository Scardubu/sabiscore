/**
 * Shared utilities for Next.js API proxy routes.
 *
 * Handles the case where the upstream backend (Render free-tier) returns an
 * HTML suspension page instead of JSON — either with status 200 or a 5xx.
 * These helpers prevent raw HTML from leaking into client error messages.
 */

/**
 * Resolve the upstream backend base URL from environment variables.
 * Falls back to localhost for local development.
 */
export function resolveBackendBaseUrl(): string {
  const configured = process.env.SABISCORE_BACKEND_URL?.trim();
  if (configured) {
    const parsed = new URL(configured);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('SABISCORE_BACKEND_URL must use http or https');
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SABISCORE_BACKEND_URL is required in production');
  }
  return 'http://127.0.0.1:8000';
}

/**
 * Return true when the text looks like an HTML page (suspended service,
 * CDN error pages, load-balancer HTML, etc.).
 */
export function isHtmlBody(body: string): boolean {
  const trimmed = body.trimStart().toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}

/**
 * Produce a safe, short error message from a backend response body.
 *
 * - If the body is HTML → returns "Backend service unavailable"
 * - Otherwise strips to ≤ 120 chars
 */
export function sanitizeBackendError(body: string, status: number): string {
  if (isHtmlBody(body)) {
    if (status === 503 || status === 0) return "Backend service unavailable";
    if (status === 200) return "Backend returned an unexpected response (not JSON)";
    return `Backend service unavailable (HTTP ${status})`;
  }
  const trimmed = body.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed || `HTTP ${status}`;
}

/**
 * Cache-Control header for all error responses.
 * Prevents Vercel Edge Network and browsers from caching 4xx/5xx responses.
 */
export const ERROR_CACHE_HEADERS: HeadersInit = {
  "Cache-Control": "no-store",
};

/**
 * Standard headers added to every proxied backend request.
 */
export function proxyHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "SabiScore-Proxy/2.0",
  };
  const backendToken = process.env.BACKEND_TOKEN?.trim();
  if (backendToken) {
    headers.Authorization = `Bearer ${backendToken}`;
  }
  return headers;
}
