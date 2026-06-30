import { NextResponse } from "next/server";
import { proxyHeaders, resolveBackendBaseUrl } from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${resolveBackendBaseUrl()}/internal/smoke`, {
      headers: proxyHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { db_connected: false, models_loaded: false, version: "unknown", timestamp: new Date().toISOString() },
        { status: 503 },
      );
    }
    return NextResponse.json(await res.json());
  } catch (error: unknown) {
    return NextResponse.json(
      {
        db_connected: false,
        models_loaded: false,
        version: "unknown",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown",
      },
      { status: 503 },
    );
  }
}
