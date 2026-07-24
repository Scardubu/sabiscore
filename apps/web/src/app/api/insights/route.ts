/**
 * Insights Proxy
 *
 * POST /api/insights
 *
 * Proxies to: POST /api/v1/insights
 *
 * Handles the Render free-tier HTML suspension page (status 200 or 503 with
 * HTML body) by returning a cold_start error instead of leaking raw HTML to
 * the client. Callers treat cold_start as a warm-up timeout and auto-retry.
 *
 * All error responses carry Cache-Control: no-store so Vercel Edge Network
 * and browsers never cache a transient 503.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveBackendBaseUrl,
  proxyHeaders,
  isHtmlBody,
  sanitizeBackendError,
  ERROR_CACHE_HEADERS,
} from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const insightsRequestSchema = z.object({
  matchup: z.string().trim().min(3).max(240),
  league: z.enum([
    "EPL",
    "LA_LIGA",
    "BUNDESLIGA",
    "SERIE_A",
    "LIGUE_1",
    "EREDIVISIE",
    "UCL",
  ]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: ERROR_CACHE_HEADERS },
    );
  }
  const parsed = insightsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", detail: "A valid matchup and league are required." },
      { status: 400, headers: ERROR_CACHE_HEADERS },
    );
  }

  const backendUrl = `${resolveBackendBaseUrl()}/api/v1/insights`;

  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      method: "POST",
      headers: proxyHeaders(),
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error("[insights proxy] fetch error:", message);
    const timedOut = err instanceof Error && (
      err.name === "AbortError" || err.name === "TimeoutError"
    );
    return NextResponse.json({
      error: timedOut ? "upstream_timeout" : "upstream_unavailable",
      detail: timedOut
        ? "The backend did not respond within 25 seconds."
        : "The backend could not be reached.",
    }, {
      status: timedOut ? 504 : 502,
      headers: ERROR_CACHE_HEADERS,
    });
  }

  const responseBody = await backendRes.text().catch(() => "");

  if (isHtmlBody(responseBody) && [502, 503, 504].includes(backendRes.status)) {
    console.error(
      "[insights proxy] HTML response from backend (status %d) — cold start",
      backendRes.status,
    );
    return NextResponse.json({
      error: "cold_start",
      detail: "The prediction engine is starting up.",
    }, {
      status: backendRes.status,
      headers: ERROR_CACHE_HEADERS,
    });
  }

  if (!backendRes.ok) {
    const detail = sanitizeBackendError(responseBody, backendRes.status);
    console.error(
      "[insights proxy] backend error %d: %s",
      backendRes.status,
      responseBody.slice(0, 200),
    );
    return NextResponse.json(
      {
        error: backendRes.status === 500
          ? "backend_internal_error"
          : [502, 503, 504].includes(backendRes.status)
            ? "upstream_unavailable"
            : "backend_error",
        detail,
      },
      { status: backendRes.status, headers: ERROR_CACHE_HEADERS },
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(responseBody);
  } catch {
    console.error("[insights proxy] non-JSON 200 body from backend");
    return NextResponse.json(
      { error: "Backend error", detail: "Backend returned an unexpected response." },
      { status: 502, headers: ERROR_CACHE_HEADERS },
    );
  }

  return NextResponse.json(data, { headers: ERROR_CACHE_HEADERS });
}
