import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.SABISCORE_BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

const BACKEND_TOKEN = process.env.BACKEND_TOKEN;

export async function proxyFixtureRequest(
  req: NextRequest,
  backendPath: string,
  init?: { method?: string; body?: string },
): Promise<NextResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (BACKEND_TOKEN) headers.Authorization = `Bearer ${BACKEND_TOKEN}`;

  try {
    const backendRes = await fetch(`${BACKEND_URL}${backendPath}`, {
      method: init?.method ?? req.method,
      headers,
      body: init?.body,
      signal: AbortSignal.timeout(15_000),
    });
    const data = await backendRes.json().catch(() => null);
    return NextResponse.json(data, {
      status: backendRes.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : "";
    return NextResponse.json(
      {
        error: name === "TimeoutError" || name === "AbortError"
          ? "BACKEND_TIMEOUT"
          : "BACKEND_UNAVAILABLE",
        message: "Could not complete the fixture intelligence request.",
      },
      { status: name === "TimeoutError" || name === "AbortError" ? 504 : 503 },
    );
  }
}
