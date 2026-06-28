import { NextRequest } from "next/server";
import { proxyFixtureRequest } from "../../proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  return proxyFixtureRequest(
    req,
    `/api/v1/fixtures/${encodeURIComponent(fixtureId)}/evidence`,
  );
}
