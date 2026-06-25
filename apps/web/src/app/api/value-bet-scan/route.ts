import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl, proxyHeaders, isHtmlBody } from '@/lib/proxy-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const days = request.nextUrl.searchParams.get('days') || '7';
    const backendBaseUrl = resolveBackendBaseUrl();
    const url = new URL(`${backendBaseUrl}/api/v1/value-bet-scan`);
    url.searchParams.set('days', days);

    const response = await fetch(url.toString(), { headers: proxyHeaders() });
    const body = await response.text().catch(() => '');

    if (!response.ok || isHtmlBody(body)) {
      return NextResponse.json(
        { fixtures: [], total: 0, days: Number(days), error: 'Backend service unavailable' },
        { status: 503 }
      );
    }

    const raw = JSON.parse(body);
    // Backend (v5) returns { items, total, data_gap }; normalise to { fixtures, total, data_gap, days, source }
    const normalised = Array.isArray(raw)
      ? { fixtures: raw, total: raw.length, data_gap: false, days: Number(days), source: "api" }
      : {
          fixtures: raw.items ?? raw.fixtures ?? [],
          total: raw.total ?? 0,
          data_gap: raw.data_gap ?? false,
          days: Number(days),
          source: raw.source ?? "api",
        };
    return NextResponse.json(normalised);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        fixtures: [],
        total: 0,
        data_gap: false,
        days: 7,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}