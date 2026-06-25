/**
 * Next.js proxy for team intelligence endpoint.
 *
 * Route: GET /api/teams/[slug]/intelligence
 * Proxies to: {BACKEND_URL}/api/v1/teams/{slug}/intelligence
 *
 * Returns rolling form, H2H summary, upcoming fixtures, and form-state verdict
 * (IMPROVING | STABLE | DECLINING | VOLATILE).
 */
import { NextRequest, NextResponse } from "next/server";
import { isHtmlBody } from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BACKEND_URL =
  process.env.SABISCORE_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 503 },
    );
  }

  // Forward optional query params (history_matches, upcoming_days)
  const qs = req.nextUrl.searchParams.toString();
  const backendUrl = `${BACKEND_URL.replace(/\/+$/, "")}/api/v1/teams/${encodeURIComponent(slug)}/intelligence${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(backendUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 300 }, // 5-minute ISR cache
    });

    const text = await upstream.text().catch(() => '');

    if (!upstream.ok || isHtmlBody(text)) {
      return NextResponse.json(
        { error: upstream.ok ? 'Backend service unavailable' : `Upstream error ${upstream.status}` },
        { status: upstream.ok ? 503 : upstream.status },
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Unexpected response from backend' }, { status: 502 });
    }
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Team intelligence fetch failed", detail: message },
      { status: 502 },
    );
  }
}
