import { NextResponse } from 'next/server';
import { UnifiedSttSessionManager } from '@/lib/unifiedSttSession';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    UnifiedSttSessionManager.instance.close(id);
    console.log('[UnifiedSTT] Session stopped:', id);
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    console.error('[UnifiedSTT] Failed to stop session:', e);
    return NextResponse.json({ error: e?.message || 'Failed to stop session' }, { status: 400 });
  }
}


