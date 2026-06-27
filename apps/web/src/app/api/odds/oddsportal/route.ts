import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "REMOVED_PROVIDER_ROUTE",
      message: "OddsPortal scraping is not part of the production provider policy.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
