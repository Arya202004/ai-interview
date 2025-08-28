import { NextResponse } from 'next/server';
import { UnifiedSttSessionManager } from '@/lib/unifiedSttSession';

export async function GET() {
  try {
    const stats = UnifiedSttSessionManager.instance.getStats();
    const backend = UnifiedSttSessionManager.instance.getBackend();
    
    let status = 'ok';
    let error = null;
    
    // Check backend-specific health
    switch (backend) {
      case 'whisper':
        if (!process.env.OPENAI_API_KEY) {
          status = 'error';
          error = 'OPENAI_API_KEY environment variable is not set';
        }
        break;
      case 'opus':
        // Opus doesn't require API keys, so it's always healthy
        status = 'ok';
        break;
      case 'google':
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
          status = 'error';
          error = 'Google Cloud credentials not configured';
        }
        break;
    }
    
    return NextResponse.json({
      status,
      backend,
      error,
      stats,
      message: `STT backend '${backend}' is ${status === 'ok' ? 'ready' : 'not configured properly'}`,
    });
  } catch (error: any) {
    console.error('[UnifiedSTT] Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message || 'Health check failed',
    }, { status: 500 });
  }
}


