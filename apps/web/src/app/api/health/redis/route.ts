/**
 * Redis Health Check API Route
 * 
 * Verifies Redis Cloud connection status and provides diagnostics.
 */

import { NextResponse } from 'next/server';
import { getRedisClient, isRedisAvailable } from '@/lib/cache/redis-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  
  try {
    const available = await isRedisAvailable();
    
    if (!available) {
      return NextResponse.json({
        status: 'disconnected',
        message: 'Redis Cloud is not reachable',
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
    
    // Get Redis info
    const client = getRedisClient();
    const info = await client.info('server');
    const memory = await client.info('memory');
    
    // Parse Redis version
    const versionMatch = info.match(/redis_version:(\S+)/);
    const usedMemoryMatch = memory.match(/used_memory_human:(\S+)/);
    
    const latency = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'connected',
      message: 'Redis Cloud is healthy',
      latency,
      redis: {
        version: versionMatch?.[1] || 'unknown',
        usedMemory: usedMemoryMatch?.[1] || 'unknown',
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      status: 'error',
      message: errorMessage,
      latency: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
