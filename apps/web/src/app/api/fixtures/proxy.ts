import { NextRequest, NextResponse } from "next/server";
import { proxyHeaders, resolveBackendBaseUrl } from "@/lib/proxy-utils";

export async function proxyFixtureRequest(
  req: NextRequest,
  backendPath: string,
  init?: { method?: string; body?: string },
): Promise<NextResponse> {
  try {
    const backendRes = await fetch(`${resolveBackendBaseUrl()}${backendPath}`, {
      method: init?.method ?? req.method,
      headers: proxyHeaders(),
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
