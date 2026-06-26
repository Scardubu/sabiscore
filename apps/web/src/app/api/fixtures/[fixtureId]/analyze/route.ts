import { NextRequest } from "next/server";
import { proxyFixtureRequest } from "../../proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: { fixtureId: string } },
) {
  return proxyFixtureRequest(
    req,
    `/api/v1/fixtures/${encodeURIComponent(params.fixtureId)}/analyze`,
    { method: "POST" },
  );
}
