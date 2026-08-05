import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl, proxyHeaders, isHtmlBody } from '@/lib/proxy-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** See the sibling summary route: the backend's own 503 body distinguishes
 *  "no settled predictions yet" from a real outage, so it is forwarded intact
 *  rather than overwritten with a fabricated empty series. */
function infrastructureError(
  message: string,
  status: number,
  league: string | null,
  window: number,
) {
  return NextResponse.json(
    {
      status: 'METRICS_UNAVAILABLE',
      reason: 'backend_unreachable',
      league,
      window,
      series: [],
      error: message,
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  const leagueParam = request.nextUrl.searchParams.get('league') || '';
  const windowParam = request.nextUrl.searchParams.get('window') || '30';
  const league = leagueParam || null;
  const window = Number(windowParam);

  try {
    const url = new URL(`${resolveBackendBaseUrl()}/api/v1/model-performance`);
    if (leagueParam) url.searchParams.set('league', leagueParam);
    url.searchParams.set('window', windowParam);

    const response = await fetch(url.toString(), { headers: proxyHeaders() });
    const body = await response.text().catch(() => '');

    if (isHtmlBody(body)) {
      return infrastructureError('Backend service unavailable', 503, league, window);
    }

    try {
      return NextResponse.json(JSON.parse(body), { status: response.status });
    } catch {
      return infrastructureError('Unexpected response from backend', 502, league, window);
    }
  } catch (error: unknown) {
    return infrastructureError(
      error instanceof Error ? error.message : 'Unknown error',
      503,
      league,
      window,
    );
  }
}
