import { NextResponse } from 'next/server';
import { UnifiedSttSessionManager } from '@/lib/unifiedSttSession';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[UnifiedSTT] Received audio chunk for session:', id, 'size:', buffer.length, 'bytes');
    UnifiedSttSessionManager.instance.writeAudio(id, buffer);
    console.log('[UnifiedSTT] Audio chunk processed for session:', id);
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    console.error('[UnifiedSTT] Failed to write audio chunk:', e);
    return NextResponse.json({ error: e?.message || 'Failed to write audio' }, { status: 400 });
  }
}


