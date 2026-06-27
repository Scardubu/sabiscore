import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.SABISCORE_BACKEND_URL ??
  "http://localhost:8000";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const warmupSecret = process.env.WARMUP_SECRET;

  if (warmupSecret && authHeader !== `Bearer ${warmupSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/health/ready`, {
      signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/json" },
    });
    const body = await response.json().catch(() => null);
    return NextResponse.json(
      {
        success: response.ok,
        backend: body,
        message: "Client-side model warmup is disabled; backend readiness checked instead.",
      },
      { status: response.status, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "BACKEND_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const POST = GET;
