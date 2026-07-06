/**
 * Next.js API route: POST /api/betting-intelligence/analyze
 * Proxies to the FastAPI strict engine endpoint.
 * Validates request body with Zod and forwards to backend.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { proxyFixtureRequest } from "@/app/api/fixtures/proxy";

const FixtureIdSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);

const AnalyzeRequestSchema = z.union([
  // Batch path
  z.object({ matches: z.array(z.object({ fixture_id: FixtureIdSchema })).min(1) }),
  // Single path — fixture_id required, odds must be valid decimal (> 1.0)
  z.object({
    fixture_id: FixtureIdSchema,
    bookmaker: z.string().optional(),
    odds: z.record(z.number().gt(1.0)).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Failed to read request body." },
      { status: 400 },
    );
  }

  let backendPath = "/api/v1/betting-intelligence/analyze/single";
  try {
    const parsed: unknown = JSON.parse(body);
    const validation = AnalyzeRequestSchema.safeParse(parsed);
    if (!validation.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: validation.error.message },
        { status: 400 },
      );
    }
    if ("matches" in validation.data) {
      backendPath = "/api/v1/betting-intelligence/analyze";
    }
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  return proxyFixtureRequest(req, backendPath, { method: "POST", body });
}
