/**
 * Next.js server-side proxy for the league off-season status endpoint.
 *
 * Route: GET /api/offseason/[league]
 * Proxies to: {BACKEND_URL}/api/v1/leagues/{league}/offseason-status
 *
 * Off-season status changes at most once per day, so we cache the response
 * for 1 hour (s-maxage=3600) to avoid hammering the backend on every page load.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL =
  process.env.SABISCORE_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ league: string }> },
): Promise<NextResponse> {
  const { league } = await params;

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'Backend URL not configured', season_status: 'UNKNOWN' },
      { status: 503 },
    );
  }

  const backendUrl = `${BACKEND_URL}/api/v1/leagues/${encodeURIComponent(league)}/offseason-status`;

  try {
    const upstream = await fetch(backendUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Node.js fetch: next revalidation handled via Cache-Control on the response
      next: { revalidate: 3600 }, // ISR-style revalidation every hour
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        {
          error: `Upstream error ${upstream.status}`,
          detail: text.slice(0, 200),
          season_status: 'UNKNOWN',
        },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();

    return NextResponse.json(data, {
      headers: {
        // Allow CDN/edge caches to cache for 1 hour; clients revalidate after 5 min
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to reach backend',
        detail: message,
        season_status: 'UNKNOWN',
      },
      { status: 502 },
    );
  }
}
