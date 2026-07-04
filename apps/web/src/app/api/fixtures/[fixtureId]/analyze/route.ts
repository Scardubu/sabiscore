import { NextRequest } from "next/server";
import { proxyFixtureRequest, validateFixtureId } from "../../proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  const invalid = validateFixtureId(fixtureId);
  if (invalid) return invalid;
  return proxyFixtureRequest(
    req,
    `/api/v1/fixtures/${encodeURIComponent(fixtureId)}/analyze`,
    { method: "POST" },
  );
}
