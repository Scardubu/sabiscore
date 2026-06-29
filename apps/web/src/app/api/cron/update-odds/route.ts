import { NextRequest, NextResponse } from "next/server";
import { resolveBackendBaseUrl } from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${resolveBackendBaseUrl()}/api/v1/providers/health`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(
      {
        success: response.ok,
        provider_gateway: payload,
        message: "Odds refresh is backend-owned; Next cron verifies provider gateway health only.",
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
