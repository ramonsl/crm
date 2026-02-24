import { linkedInJobAutomationService } from '@/services/LinkedInJobAutomationService';
import { dbLogger } from '@/lib/logger';

import { requireAuth } from '@/lib/auth/requireAuth';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 1. Authenticate Request natively inside the route to bypass proxy edge closure bugs on streaming
    try {
        await requireAuth(req);
    } catch (error) {
        dbLogger.warn('[API] Unauthorized access attempt to job sync stream');
        return new Response('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            dbLogger.info('[API] Manually triggering job sync (SSE Stream)');

            const sendEvent = (data: unknown) => {
                // Formatting according to the Server-Sent Events standard
                const message = `data: ${JSON.stringify(data)}\n\n`;
                // Ignored if controller is closed
                try {
                    controller.enqueue(encoder.encode(message));
                } catch (e) {
                    console.error('[SSE] Failed to enqueue event:', e);
                }
            };

            sendEvent({ type: 'info', message: 'Iniciando sincronização através da esteira de automação...' });

            const onProgress = (msg: string) => {
                sendEvent({ type: 'progress', message: msg });
            };

            try {
                const stats = await linkedInJobAutomationService.runSync(onProgress);
                sendEvent({ type: 'complete', stats });
            } catch (error) {
                dbLogger.error('[API] Job sync stream failed:', error);
                sendEvent({ type: 'error', message: error instanceof Error ? error.message : 'Internal Server Error' });
            } finally {
                try {
                    controller.close();
                } catch (e) {
                    console.error('[SSE] Failed to close stream controller:', e);
                }
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
