import { NextRequest } from "next/server";
import { proxyFixtureRequest } from "../proxy";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.toString();
  return proxyFixtureRequest(req, `/api/v1/fixtures/upcoming${search ? `?${search}` : ""}`);
}
