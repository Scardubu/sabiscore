import { NextResponse } from "next/server";
import { resolveBackendBaseUrl, proxyHeaders, isHtmlBody } from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backendBaseUrl = resolveBackendBaseUrl();
    const url = `${backendBaseUrl}/api/v1/sources/freshness`;

    const response = await fetch(url, { headers: proxyHeaders() });
    const body = await response.text().catch(() => "");

    if (!response.ok || isHtmlBody(body)) {
      return NextResponse.json(
        { status: "UNAVAILABLE", sources: [] },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const parsed = JSON.parse(body) as unknown;
    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { status: "UNKNOWN", sources: [] },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json({ status: "AVAILABLE", sources: parsed }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { status: "FETCH_FAILED", sources: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
