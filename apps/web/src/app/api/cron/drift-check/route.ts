/**
 * Cron: Drift Check
 *
 * Runs every 6 hours. Queries the backend monitoring endpoint for model drift
 * signals and forwards critical/high alerts to the configured webhook.
 *
 * NOTE: The previous implementation called freeMonitoring.detectDrift() which
 * reads window.localStorage — impossible in a server-side Node.js cron context.
 * This version proxies the backend's own monitoring health instead.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DriftSeverity = "critical" | "high" | "medium" | "low" | "none";

const ALERT_SEVERITIES: DriftSeverity[] = ["critical", "high"];

async function sendWebhookAlert(
  severity: DriftSeverity,
  recommendation: string,
  metrics: Record<string, unknown>
): Promise<boolean> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const emoji: Record<DriftSeverity, string> = {
    critical: "🚨", high: "⚠️", medium: "📊", low: "ℹ️", none: "✅",
  };
  const color: Record<DriftSeverity, number> = {
    critical: 0xff0000, high: 0xff6600, medium: 0xffcc00, low: 0x0066ff, none: 0x00ff00,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "SabiScore Monitoring",
        embeds: [{
          title: `${emoji[severity]} Model Drift Alert: ${severity.toUpperCase()}`,
          description: recommendation,
          color: color[severity],
          fields: Object.entries(metrics).slice(0, 6).map(([k, v]) => ({
            name: k,
            value: String(v),
            inline: true,
          })),
          footer: { text: "SabiScore Model Monitoring" },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = process.env.SABISCORE_BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({
      success: false,
      status: "no_signal",
      reason: "SABISCORE_BACKEND_URL not configured",
    });
  }

  try {
    const res = await fetch(`${backendUrl}/api/v1/monitoring/health`, {
      signal: AbortSignal.timeout(10_000),
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({
        success: true,
        status: "no_signal",
        reason: `backend_returned_${res.status}`,
        timestamp: new Date().toISOString(),
      });
    }

    const data = await res.json() as Record<string, unknown>;

    const severity = (data.drift_severity ?? data.severity ?? "none") as DriftSeverity;
    const recommendation = String(data.recommendation ?? "No action required");
    const metrics = (data.metrics ?? {}) as Record<string, unknown>;
    const driftDetected = severity !== "none";

    let alertSent = false;
    if (ALERT_SEVERITIES.includes(severity)) {
      console.error(`[CRON] ${severity.toUpperCase()} drift detected from backend`);
      alertSent = await sendWebhookAlert(severity, recommendation, metrics);
    }

    return NextResponse.json({
      success: true,
      drift: { driftDetected, severity, recommendation, metrics },
      alertSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Drift check failed:", error);
    return NextResponse.json({
      success: true,
      status: "no_signal",
      reason: "backend_unavailable",
      timestamp: new Date().toISOString(),
    });
  }
}
