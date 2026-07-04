import { NextRequest, NextResponse } from "next/server";
import { proxyFixtureRequest, validateFixtureId } from "../../proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  const invalid = validateFixtureId(fixtureId);
  if (invalid) return invalid;
  const body = await req.text().catch(() => null);
  if (body == null) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  return proxyFixtureRequest(
    req,
    `/api/v1/fixtures/${encodeURIComponent(fixtureId)}/odds-snapshot`,
    { method: "POST", body },
  );
}
