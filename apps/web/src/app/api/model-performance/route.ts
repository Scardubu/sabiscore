import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl, proxyHeaders, isHtmlBody } from '@/lib/proxy-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const league = request.nextUrl.searchParams.get('league') || '';
    const window = request.nextUrl.searchParams.get('window') || '30';

    const url = new URL(`${resolveBackendBaseUrl()}/api/v1/model-performance`);
    if (league) url.searchParams.set('league', league);
    url.searchParams.set('window', window);

    const response = await fetch(url.toString(), { headers: proxyHeaders() });
    const body = await response.text().catch(() => '');

    if (!response.ok || isHtmlBody(body)) {
      return NextResponse.json(
        { league: league || null, window: Number(window), series: [], error: 'Backend service unavailable' },
        { status: 503 }
      );
    }

    try {
      return NextResponse.json(JSON.parse(body));
    } catch {
      return NextResponse.json(
        { league: league || null, window: Number(window), series: [], error: 'Unexpected response from backend' },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { league: null, window: 30, series: [], error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
