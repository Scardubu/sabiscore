import { NextResponse } from "next/server";

const BACKEND_URL = process.env.SABISCORE_BACKEND_URL;

const BACKEND_TOKEN = process.env.BACKEND_TOKEN;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "BACKEND_NOT_CONFIGURED", message: "SABISCORE_BACKEND_URL is not set." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (BACKEND_TOKEN) {
    headers.Authorization = `Bearer ${BACKEND_TOKEN}`;
  }

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/v1/betting-intelligence/policy`, {
      headers,
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
