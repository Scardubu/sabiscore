import { NextResponse } from 'next/server';
import { resolveBackendBaseUrl, proxyHeaders, isHtmlBody } from '@/lib/proxy-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMPTY = { accuracy_30d: 0, accuracy_season: 0, clv_30d: 0, bets_tracked: 0, roi_30d: 0 };

export async function GET() {
  try {
    const url = `${resolveBackendBaseUrl()}/api/v1/model-performance/summary`;
    const response = await fetch(url, { headers: proxyHeaders() });
    const body = await response.text().catch(() => '');

    if (!response.ok || isHtmlBody(body)) {
      return NextResponse.json({ ...EMPTY, error: 'Backend service unavailable' }, { status: 503 });
    }

    try {
      return NextResponse.json(JSON.parse(body));
    } catch {
      return NextResponse.json({ ...EMPTY, error: 'Unexpected response from backend' }, { status: 502 });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { ...EMPTY, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
