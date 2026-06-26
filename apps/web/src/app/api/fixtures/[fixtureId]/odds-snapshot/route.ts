import { NextRequest, NextResponse } from "next/server";
import { proxyFixtureRequest } from "../../proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: { fixtureId: string } },
) {
  const body = await req.text().catch(() => null);
  if (body == null) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  return proxyFixtureRequest(
    req,
    `/api/v1/fixtures/${encodeURIComponent(params.fixtureId)}/odds-snapshot`,
    { method: "POST", body },
  );
}
