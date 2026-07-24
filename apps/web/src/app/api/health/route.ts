/**
 * Health Check API Route
 *
 * Proxies backend /health/ready for live infrastructure status.
 * Historical Phase 7 artifact benchmarks are returned as-is until
 * live prediction data accumulates — hasSufficientData stays false until
 * the walk-forward RPS run completes with live match data.
 */

import { NextResponse } from "next/server";
import { backendHealthIssues, isHealthyBackendStatus } from "@/lib/health-status";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.SABISCORE_BACKEND_URL;

// Historical Phase 7 artifact benchmark. These are not labelled live results.
const PHASE7_BASELINE = {
  accuracy: 0.51,
  brierScore: 0.225,
  rpsGate: 0.210,
  avgEdgePct: 0.084,
};

export async function GET() {
  let backendStatus = "unavailable";
  let backendChecks: Record<string, unknown> = {};
  let providers: Array<Record<string, unknown>> = [];

  if (BACKEND_URL) {
    try {
      const [readinessRes, providersRes] = await Promise.all([
        fetch(`${BACKEND_URL}/health/ready`, {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
        fetch(`${BACKEND_URL}/api/v1/providers/health`, {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
      ]);
      if (readinessRes.ok) {
        const data = (await readinessRes.json()) as Record<string, unknown>;
        backendStatus = (data.status as string) ?? "unknown";
        backendChecks = (data.checks as Record<string, unknown>) ?? {};
      } else {
        backendStatus = "degraded";
      }
      if (providersRes.ok) {
        const providerData = (await providersRes.json()) as { providers?: unknown };
        providers = Array.isArray(providerData.providers)
          ? providerData.providers as Array<Record<string, unknown>>
          : [];
      }
    } catch {
      backendStatus = "unavailable";
    }
  }

  const isHealthy = isHealthyBackendStatus(backendStatus);

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      backendStatus,
      backendChecks,
      providers,
      ...PHASE7_BASELINE,
      predictionCount: 0,
      metrics: { ...PHASE7_BASELINE, predictionCount: 0 },
      issues: backendHealthIssues(backendStatus),
      hasSufficientData: false,
      lastUpdate: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      modelVersion: "v5_phase7",
      sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
