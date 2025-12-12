/**
 * Backend Keepalive Cron Job
 * 
 * Pings the Render.com backend every 10 minutes to prevent cold starts.
 * Render's free tier spins down after 15 minutes of inactivity.
 * 
 * Impact: Eliminates backend cold start delays (5-30s)
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sabiscore-api.onrender.com';
  
  try {
    console.log(`🔥 Pinging backend: ${backendUrl}/health`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'User-Agent': 'SabiScore-Keepalive/1.0',
        'X-Keepalive-Ping': 'true',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const responseTime = Date.now();
    const isHealthy = response.ok;
    const status = response.status;
    
    // Try to get response body for additional info
    let healthData = null;
    try {
      healthData = await response.json();
    } catch {
      // Response might not be JSON, that's okay
    }
    
    console.log(`✅ Backend ping ${isHealthy ? 'successful' : 'failed'}: ${status}`);
    
    return NextResponse.json({
      status: 'pinged',
      backend: {
        url: backendUrl,
        healthy: isHealthy,
        statusCode: status,
        responseTime: new Date(responseTime).toISOString(),
        data: healthData,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ Backend ping failed:', error);
    
    return NextResponse.json({
      status: 'error',
      backend: {
        url: backendUrl,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
