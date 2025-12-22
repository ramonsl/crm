/**
 * API: /api/automation/queue/trigger
 * 
 * Manual trigger for queue automation.
 * Allows starting/stopping the automation loop manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queueAutomationService } from '@/services/QueueAutomationService';

/**
 * POST /api/automation/queue/trigger
 * Manually trigger the queue automation to send next message
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const action = body.action as string | undefined;

        // Start continuous sending loop
        if (action === 'start') {
            const result = await queueAutomationService.startLoop();
            return NextResponse.json(result);
        }

        // Stop the loop
        if (action === 'stop') {
            queueAutomationService.stopLoop();
            return NextResponse.json({
                success: true,
                message: 'Automação pausada'
            });
        }

        // Single trigger (send one message)
        const result = await queueAutomationService.onQueueEmpty();
        return NextResponse.json(result);

    } catch (error) {
        console.error('[API /api/automation/queue/trigger POST] Error:', error);
        return NextResponse.json(
            { error: 'Failed to trigger automation' },
            { status: 500 }
        );
    }
}
