import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js ISR Revalidation API
 * 
 * Allows backend to trigger on-demand revalidation when match data updates.
 * Called by WebSocket layer when goals/odds change requiring fresh renders.
 * 
 * Usage: POST /api/revalidate with { secret, path }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, path } = body;

    // Verify revalidation secret
    const revalidateSecret = process.env.REVALIDATE_SECRET || 'dev-secret-token';
    
    if (secret !== revalidateSecret) {
      return NextResponse.json(
        { error: 'Invalid secret' },
        { status: 401 }
      );
    }

    // Validate path format
    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        { error: 'Invalid path parameter' },
        { status: 400 }
      );
    }

    // Revalidate the specified path
    revalidatePath(path);

    return NextResponse.json(
      { 
        revalidated: true, 
        path,
        timestamp: new Date().toISOString() 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Revalidation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Revalidation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json(
    { 
      status: 'ready',
      endpoint: '/api/revalidate',
      method: 'POST'
    },
    { status: 200 }
  );
}
