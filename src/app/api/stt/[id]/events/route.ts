import { NextResponse } from 'next/server';
import { UnifiedSttSessionManager } from '@/lib/unifiedSttSession';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  console.log('[UnifiedSTT] Events request for session:', id);
  
  const session = UnifiedSttSessionManager.instance.getSession(id);
  if (!session) {
    console.log('[UnifiedSTT] Session not found:', id);
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;
      
      const sendEvent = (event: any) => {
        if (isClosed) return;
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        } catch (err) {
          console.error('[UnifiedSTT] Error sending event:', err);
        }
      };

      const handleEvent = (event: any) => {
        sendEvent(event);
        if (event.type === 'end' || event.type === 'error') {
          isClosed = true;
          controller.close();
        }
      };

      session.emitter.on('event', handleEvent);

      // Handle client disconnect
      const cleanup = () => {
        isClosed = true;
        session.emitter.off('event', handleEvent);
        controller.close();
      };

      // This is a simplified approach - in production you'd want proper cleanup
      setTimeout(cleanup, 300000); // 5 minutes max
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}


