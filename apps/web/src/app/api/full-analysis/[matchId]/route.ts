/**
 * Phase 7-D: Unified Match Intelligence Proxy
 *
 * GET /api/full-analysis/[matchId]
 *
 * Proxies to: GET /api/v1/matches/upcoming/{matchId}/full-analysis
 *
 * Error responses carry Cache-Control: no-store so Vercel Edge Network and
 * browsers never cache a transient cold-start 503.
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

const routeParamsSchema = z.object({
  matchId: z.string().trim().min(1).max(240),
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
): Promise<NextResponse> {
  const { matchId } = await params;

  const parsed = routeParamsSchema.safeParse({
    matchId,
    league: request.nextUrl.searchParams.get("league") ?? "EPL",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", detail: "A valid matchId and league are required." },
      { status: 400, headers: ERROR_CACHE_HEADERS },
    );
  }

  const backendUrl = `${resolveBackendBaseUrl()}/api/v1/matches/upcoming/${encodeURIComponent(parsed.data.matchId)}/full-analysis?league=${encodeURIComponent(parsed.data.league)}`;

  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      headers: proxyHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error("[full-analysis proxy] fetch error:", message);
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

  const body = await backendRes.text().catch(() => "");

  if (isHtmlBody(body) && [502, 503, 504].includes(backendRes.status)) {
    console.error(
      "[full-analysis proxy] HTML response from backend (status %d) — cold start",
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
    const detail = sanitizeBackendError(body, backendRes.status);
    console.error(
      "[full-analysis proxy] backend error %d: %s",
      backendRes.status,
      body.slice(0, 200),
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
    data = JSON.parse(body);
  } catch {
    console.error("[full-analysis proxy] non-JSON body from backend (status 200)");
    return NextResponse.json(
      { error: "Backend error", detail: "Backend returned an unexpected response." },
      { status: 502, headers: ERROR_CACHE_HEADERS },
    );
  }

  return NextResponse.json(data, {
    headers: ERROR_CACHE_HEADERS,
  });
}
