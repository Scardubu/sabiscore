import { NextRequest, NextResponse } from "next/server";
import {
  resolveBackendBaseUrl,
  proxyHeaders,
  isHtmlBody,
  sanitizeBackendError,
} from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params;
    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/explain/${encodeURIComponent(matchId)}`;

    const res = await fetch(backendUrl, {
      headers: proxyHeaders(),
      cache: "no-store",
    });

    const body = await res.text().catch(() => "");

    if (!res.ok || isHtmlBody(body)) {
      return NextResponse.json(
        { error: "Backend error", detail: sanitizeBackendError(body, res.status), match_id: matchId },
        { status: res.ok ? 503 : res.status },
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: "Backend error", detail: "Backend returned an unexpected response.", match_id: matchId },
        { status: 502 },
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Backend unreachable", detail: message },
      { status: 503 },
    );
  }
}
