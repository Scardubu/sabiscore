import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "REMOVED_PROVIDER_ROUTE",
      message: "Football data provider calls are backend-only. Use /api/fixtures and /api/betting-intelligence proxies.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
