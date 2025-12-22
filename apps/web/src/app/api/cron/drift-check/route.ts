/**
 * Cron: Drift Check
 * 
 * Runs every 6 hours to detect model performance drift.
 * Vercel Cron job configuration in vercel.json.
 * 
 * Supports webhook alerts via ALERT_WEBHOOK_URL environment variable.
 * Note: Uses Node.js runtime for localStorage compatibility in freeMonitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { freeMonitoring, type DriftReport } from '@/lib/monitoring/free-analytics';

// Use Node.js runtime for localStorage compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Severity type from DriftReport
type DriftSeverity = DriftReport['severity'];

// Severity levels that trigger alerts
const ALERT_SEVERITIES: DriftSeverity[] = ['critical', 'high'];

/**
 * Send alert to configured webhook (Discord, Slack, etc.)
 */
async function sendWebhookAlert(drift: DriftReport): Promise<boolean> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('[ALERT] No webhook URL configured');
    return false;
  }
  
  // Map severity to emoji - must match DriftReport severity type
  const severityEmoji: Record<DriftSeverity, string> = {
    critical: '🚨',
    high: '⚠️',
    medium: '📊',
    low: 'ℹ️',
    none: '✅'
  };
  
  // Map severity to Discord embed color
  const severityColor: Record<DriftSeverity, number> = {
    critical: 0xff0000,      // Red
    high: 0xff6600,          // Orange
    medium: 0xffcc00,        // Yellow
    low: 0x0066ff,           // Blue
    none: 0x00ff00           // Green
  };
  
  try {
    // Format for Discord/Slack compatible webhooks
    const payload = {
      username: 'SabiScore Monitoring',
      embeds: [{
        title: `${severityEmoji[drift.severity]} Model Drift Alert: ${drift.severity.toUpperCase()}`,
        description: drift.recommendation,
        color: severityColor[drift.severity],
        fields: [
          {
            name: 'Accuracy Drift',
            value: `${(drift.metrics.accuracyDrift * 100).toFixed(2)}%`,
            inline: true
          },
          {
            name: 'Brier Drift',
            value: drift.metrics.brierDrift.toFixed(4),
            inline: true
          },
          {
            name: 'ROI Drift',
            value: `${drift.metrics.roiDrift > 0 ? '+' : ''}${drift.metrics.roiDrift.toFixed(2)}%`,
            inline: true
          }
        ],
        footer: {
          text: 'SabiScore Model Monitoring'
        },
        timestamp: new Date().toISOString()
      }]
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('[ALERT] Webhook failed:', response.status, response.statusText);
      return false;
    }
    
    console.log('[ALERT] Webhook sent successfully');
    return true;
    
  } catch (error) {
    console.error('[ALERT] Webhook error:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const drift = await freeMonitoring.detectDrift();
    
    // Log results
    console.log('[CRON] Drift check:', {
      detected: drift.driftDetected,
      severity: drift.severity,
      recommendation: drift.recommendation,
    });
    
    let alertSent = false;
    
    // Send alerts for critical/significant drift
    if (ALERT_SEVERITIES.includes(drift.severity as typeof ALERT_SEVERITIES[number])) {
      console.error(`[ALERT] ${drift.severity.toUpperCase()} model drift detected!`);
      alertSent = await sendWebhookAlert(drift);
    }
    
    return NextResponse.json({
      success: true,
      drift,
      alertSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Drift check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
