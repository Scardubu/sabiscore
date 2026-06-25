import { NextResponse } from "next/server";
import { resolveBackendBaseUrl, proxyHeaders, isHtmlBody } from "@/lib/proxy-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${resolveBackendBaseUrl()}/health/ready`, {
      headers: proxyHeaders(),
      cache: "no-store",
    });
    const body = await res.text().catch(() => "");
    if (isHtmlBody(body) || !res.ok) {
      return NextResponse.json(
        { status: "error", error: "Backend service unavailable" },
        { status: 503 },
      );
    }
    try {
      return NextResponse.json(JSON.parse(body), { status: 200 });
    } catch {
      return NextResponse.json({ status: "error", error: "Unexpected backend response" }, { status: 502 });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message : "Unknown" },
      { status: 503 },
    );
  }
}
