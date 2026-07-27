/**
 * Server-side Phase-7 insights fetch.
 *
 * This lives apart from `lib/api.ts` on purpose. `lib/api.ts` is also bundled for
 * the browser (it exports `apiClient`), and this module reads the server-only
 * `SABISCORE_BACKEND_URL`.
 *
 * It also calls the backend directly rather than the app's own `/api/insights`
 * proxy: a relative URL cannot be fetched from a server component (undici throws
 * `Failed to parse URL from /api/insights`), and routing a server render back
 * through our own edge would be a wasted round trip. The browser-side
 * `apiClient.generateInsights` still uses the proxy, which is where the Zod gate
 * and cold-start shaping belong.
 */

import { APIError, type InsightsResponse } from "@/lib/api";
import { classifyAnalysisError } from "@/lib/full-analysis-contract";
import {
  isHtmlBody,
  proxyHeaders,
  resolveBackendBaseUrl,
  sanitizeBackendError,
} from "@/lib/proxy-utils";

/** Matches the upstream budget used by the match-analysis proxy. */
const INSIGHTS_TIMEOUT_MS = 25_000;

export async function getMatchInsights(
  matchup: string,
  league: string = "EPL",
): Promise<InsightsResponse> {
  const url = `${resolveBackendBaseUrl()}/api/v1/insights`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: proxyHeaders(),
      body: JSON.stringify({ matchup, league }),
      cache: "no-store",
      signal: AbortSignal.timeout(INSIGHTS_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError");
    if (timedOut) {
      throw new APIError(
        "The analysis backend did not respond in time.",
        408,
        "TIMEOUT",
      );
    }
    throw new APIError(
      error instanceof Error ? error.message : "Network error",
      0,
      "NETWORK_ERROR",
    );
  }

  const bodyText = await response.text().catch(() => "");

  if (!response.ok) {
    // An HTML body from Render means the instance is asleep, not a real 4xx.
    if (isHtmlBody(bodyText)) {
      throw new APIError(
        "The prediction engine is warming up.",
        response.status,
        "COLD_START",
      );
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      /* non-JSON error body — fall back to the sanitised text */
    }

    // The backend nests its envelope under `detail`.
    const detail = parsed.detail;
    const envelope =
      detail && typeof detail === "object"
        ? (detail as { detail?: unknown; error_code?: unknown })
        : undefined;

    const message =
      (typeof envelope?.detail === "string" && envelope.detail) ||
      (typeof detail === "string" && detail) ||
      sanitizeBackendError(bodyText, response.status);

    // Preserve the backend's own error code. Overwriting it with the display
    // category is what previously made the caller's INVALID_MATCHUP branch dead.
    const code =
      typeof envelope?.error_code === "string"
        ? envelope.error_code
        : classifyAnalysisError({ status: response.status }).toUpperCase();

    throw new APIError(message, response.status, code);
  }

  try {
    return JSON.parse(bodyText) as InsightsResponse;
  } catch {
    throw new APIError(
      "The backend returned an unexpected insights response.",
      502,
      "INVALID_RESPONSE",
    );
  }
}
