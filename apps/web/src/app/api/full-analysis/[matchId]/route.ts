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

const COLD_START_BODY = {
  error: "cold_start",
  detail: "The prediction engine is starting up.",
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
): Promise<NextResponse> {
  const { matchId } = await params;

  if (!matchId || typeof matchId !== "string") {
    return NextResponse.json(
      { error: "matchId is required" },
      { status: 400, headers: ERROR_CACHE_HEADERS },
    );
  }

  const league = request.nextUrl.searchParams.get("league") ?? "EPL";
  const backendUrl = `${resolveBackendBaseUrl()}/api/v1/matches/upcoming/${encodeURIComponent(matchId)}/full-analysis?league=${encodeURIComponent(league)}`;

  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      headers: proxyHeaders(),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error("[full-analysis proxy] fetch error:", message);
    return NextResponse.json(COLD_START_BODY, {
      status: 503,
      headers: ERROR_CACHE_HEADERS,
    });
  }

  const body = await backendRes.text().catch(() => "");

  if (isHtmlBody(body)) {
    console.error(
      "[full-analysis proxy] HTML response from backend (status %d) — cold start",
      backendRes.status,
    );
    return NextResponse.json(COLD_START_BODY, {
      status: 503,
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
      { error: "Backend error", detail },
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
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
