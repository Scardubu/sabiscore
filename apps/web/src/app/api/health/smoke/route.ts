import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveBackendBaseUrl(): string {
  const configured =
    process.env.SABISCORE_BACKEND_URL;
  if (configured && configured.trim().length > 0) return configured.replace(/\/+$/, "");
  return "http://127.0.0.1:8000";
}

export async function GET() {
  try {
    const backendToken = process.env.BACKEND_TOKEN || "development-token";
    const res = await fetch(`${resolveBackendBaseUrl()}/internal/smoke`, {
      headers: { Authorization: `Bearer ${backendToken}` },
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
