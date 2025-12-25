/**
 * YCloud Webhook API Endpoint
 * 
 * Receives webhook callbacks from YCloud for:
 * - Inbound WhatsApp messages
 * - Message delivery status updates
 * 
 * URL: POST /api/ycloud/webhook
 */

import { NextResponse } from 'next/server';
import { yCloudWebhookService } from '@/services/YCloudWebhookService';
import { yCloudLogger } from '@/lib/logger';
import type { YCloudWebhookEvent } from '@/types/ycloud';

/**
 * POST /api/ycloud/webhook
 * 
 * Receives webhook events from YCloud.
 * Returns 200 immediately to acknowledge receipt (required by YCloud).
 */
export async function POST(request: Request) {
    try {
        const body = await request.json() as YCloudWebhookEvent;

        yCloudLogger.info('Received YCloud webhook', {
            eventId: body.id,
            eventType: body.type
        });

        // Process the event asynchronously
        // We respond immediately to YCloud, then process
        const result = await yCloudWebhookService.processEvent(body);

        yCloudLogger.debug('Webhook processed', {
            eventId: body.id,
            result
        });

        return NextResponse.json({
            success: true,
            eventId: body.id,
            ...result
        });

    } catch (error) {
        yCloudLogger.error('YCloud webhook error:', error);

        // Still return 200 to prevent YCloud from retrying
        // Log the error for investigation
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 200 }); // Return 200 to acknowledge receipt
    }
}

/**
 * GET /api/ycloud/webhook
 * 
 * Health check endpoint - YCloud may ping this to verify the URL.
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'ycloud-webhook',
        timestamp: new Date().toISOString()
    });
}
