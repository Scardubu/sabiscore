import { NextResponse } from "next/server";
import { resolveBackendBaseUrl, proxyHeaders, isHtmlBody } from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backendBaseUrl = resolveBackendBaseUrl();
    const url = `${backendBaseUrl}/api/v1/leagues/`;

    const response = await fetch(url, { headers: proxyHeaders(), next: { revalidate: 3600 } });
    const body = await response.text().catch(() => "");

    if (!response.ok || isHtmlBody(body)) {
      return NextResponse.json([], { status: 503 });
    }

    return NextResponse.json(JSON.parse(body), {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
