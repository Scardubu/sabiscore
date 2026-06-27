/**
 * GET /api/upcoming/all
 *
 * Proxies merged all-leagues upcoming fixtures from backend.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function resolveBackendBaseUrl(): string {
  const configured =
    process.env.SABISCORE_BACKEND_URL;
  if (configured && configured.trim().length > 0) {
    return configured.replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8000";
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = searchParams.get("days") || "7";
    const limit = searchParams.get("limit") || "200";

    const backendBaseUrl = resolveBackendBaseUrl();
    const url = new URL(`${backendBaseUrl}/api/v1/upcoming/all`);
    url.searchParams.set("days", days);
    url.searchParams.set("limit", limit);

    const backendToken = process.env.BACKEND_TOKEN || "development-token";
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${backendToken}`,
        "User-Agent": "SabiScore/2.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          fixtures: [],
          total: 0,
          days: Number(days),
          source: "error",
          cache_ttl_seconds: 300,
          error: `Backend error ${response.status}`,
        },
        { status: 500 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        fixtures: [],
        total: 0,
        days: 7,
        source: "error",
        cache_ttl_seconds: 300,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
