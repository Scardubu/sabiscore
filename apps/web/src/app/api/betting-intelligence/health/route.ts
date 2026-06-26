import { NextRequest } from "next/server";
import { proxyFixtureRequest } from "../../fixtures/proxy";

export async function GET(req: NextRequest) {
  return proxyFixtureRequest(req, "/api/v1/betting-intelligence/health");
}
