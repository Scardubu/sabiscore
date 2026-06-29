import { NextResponse } from "next/server";
import {
  ERROR_CACHE_HEADERS,
  isHtmlBody,
  proxyHeaders,
  resolveBackendBaseUrl,
  sanitizeBackendError,
} from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

type BackendReadiness = {
  status?: unknown;
  ready?: unknown;
  checks?: Record<string, { status?: unknown }>;
  version?: unknown;
};

function safeChecks(checks: BackendReadiness["checks"]): Record<string, { status: string }> {
  if (!checks || typeof checks !== "object") return {};
  return Object.fromEntries(
    Object.entries(checks).map(([name, value]) => [
      name,
      { status: typeof value?.status === "string" ? value.status : "unknown" },
    ]),
  );
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);

  try {
    const response = await fetch(`${resolveBackendBaseUrl()}/health/ready`, {
      headers: proxyHeaders(),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok || isHtmlBody(text)) {
      return NextResponse.json(
        {
          status: "not_ready",
          ready: false,
          source: "backend-readiness",
          error: sanitizeBackendError(text, response.status),
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers: ERROR_CACHE_HEADERS },
      );
    }

    let payload: BackendReadiness;
    try {
      payload = JSON.parse(text) as BackendReadiness;
    } catch {
      return NextResponse.json(
        {
          status: "not_ready",
          ready: false,
          source: "backend-readiness",
          error: "Backend returned an unexpected response",
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers: ERROR_CACHE_HEADERS },
      );
    }

    const ready = payload.ready === true || payload.status === "ready" || payload.status === "healthy";
    return NextResponse.json(
      {
        status: ready ? "ready" : "not_ready",
        ready,
        source: "backend-readiness",
        checks: safeChecks(payload.checks),
        version: typeof payload.version === "string" ? payload.version : undefined,
        timestamp: new Date().toISOString(),
      },
      {
        status: ready ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        status: "not_ready",
        ready: false,
        source: "backend-readiness",
        error: timedOut ? "Backend readiness check timed out" : "Backend readiness check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: ERROR_CACHE_HEADERS },
    );
  } finally {
    clearTimeout(timeout);
  }
}
