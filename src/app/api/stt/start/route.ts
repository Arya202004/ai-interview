import { NextRequest, NextResponse } from 'next/server';
import { UnifiedSttSessionManager } from '@/lib/unifiedSttSession';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { languageCode = 'en-US', sampleRateHertz = 16000 } = await request.json();
    
    const id = crypto.randomUUID();
    const session = UnifiedSttSessionManager.instance.createSession(id, { languageCode, sampleRateHertz });
    
    console.log('[UnifiedSTT] Session created:', id, 'backend:', UnifiedSttSessionManager.instance.getBackend());
    
    return NextResponse.json({
      id,
      eventsUrl: `/api/stt/${id}/events`,
      backend: UnifiedSttSessionManager.instance.getBackend(),
      config: {
        languageCode: session.languageCode,
        sampleRateHertz: session.sampleRateHertz,
      }
    });
  } catch (error) {
    console.error('[UnifiedSTT] Failed to create session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}


