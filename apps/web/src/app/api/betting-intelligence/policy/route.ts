import { NextResponse } from "next/server";
import { proxyHeaders, resolveBackendBaseUrl } from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const backendRes = await fetch(`${resolveBackendBaseUrl()}/api/v1/betting-intelligence/policy`, {
      headers: proxyHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await backendRes.json().catch(() => null);
    return NextResponse.json(data, {
      status: backendRes.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "BACKEND_UNAVAILABLE", message: "Could not reach the SabiScore backend." },
      { status: 503 },
    );
  }
}
