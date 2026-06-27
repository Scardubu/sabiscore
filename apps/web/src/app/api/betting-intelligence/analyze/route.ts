/**
 * Next.js API route: POST /api/betting-intelligence/analyze
 * Proxies to the FastAPI strict engine endpoint.
 * Adds CORS headers, validates Content-Type, and forwards auth tokens.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.SABISCORE_BACKEND_URL ??
  "http://localhost:8000";

const BACKEND_TOKEN = process.env.BACKEND_TOKEN;

async function proxyToBackend(
  req: NextRequest,
  path: string,
  body: string,
): Promise<NextResponse> {
  const url = `${BACKEND_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (BACKEND_TOKEN) {
    headers["Authorization"] = `Bearer ${BACKEND_TOKEN}`;
  }

  try {
    const backendRes = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== "GET" ? body : undefined,
      // 15s timeout for analysis
      signal: AbortSignal.timeout(15_000),
    });

    const data = await backendRes.json().catch(() => null);

    return NextResponse.json(data, {
      status: backendRes.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Powered-By": "SabiScore-Engine/1.1.0",
      },
    });
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return NextResponse.json(
        {
          error: "ENGINE_TIMEOUT",
          message: "Analysis request timed out. The backend may be cold-starting.",
        },
        { status: 504 },
      );
    }
    return NextResponse.json(
      {
        error: "BACKEND_UNAVAILABLE",
        message: "Could not reach the SabiScore backend.",
      },
      { status: 503 },
    );
  }
}

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
    const parsed = JSON.parse(body) as { matches?: unknown };
    if (Array.isArray(parsed.matches)) {
      backendPath = "/api/v1/betting-intelligence/analyze";
    }
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  return proxyToBackend(req, backendPath, body);
}
