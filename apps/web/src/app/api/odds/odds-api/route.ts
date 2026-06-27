import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "REMOVED_PROVIDER_ROUTE",
      message: "Provider odds are available only through the FastAPI provider gateway and fixture evidence APIs.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
