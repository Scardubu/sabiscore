/**
 * Proxy: GET /api/providers/health → FastAPI GET /api/v1/providers/health
 *
 * Returns the real-time health status of all configured provider adapters.
 * The frontend NEVER reads provider credentials — this proxies the backend
 * which owns all credential access. Cache-Control: no-store prevents stale
 * provider status from being shown to the user.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.SABISCORE_BACKEND_URL;

export async function GET(request: NextRequest) {
  if (!BACKEND_URL) {
    return Response.json(
      { error: "Backend not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  const backendUrl = new URL(`${BACKEND_URL}/api/v1/providers/health`);
  if (provider) backendUrl.searchParams.set("provider", provider);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(backendUrl.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return Response.json(
        { error: "Backend returned non-OK status", status: res.status },
        { status: res.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = await res.json();
    return Response.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return Response.json(
      { error: isTimeout ? "Backend timeout" : "Backend unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
