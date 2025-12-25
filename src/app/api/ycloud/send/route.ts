/**
 * YCloud Send Message API
 * 
 * Endpoint to send template messages via YCloud API.
 * Used for testing YCloud integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { YCloudProvider } from '@/lib/providers/YCloudProvider';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, templateName, variables = [] } = body;

        if (!phone) {
            return NextResponse.json(
                { success: false, error: 'Phone number is required' },
                { status: 400 }
            );
        }

        if (!templateName) {
            return NextResponse.json(
                { success: false, error: 'Template name is required' },
                { status: 400 }
            );
        }

        const ycloud = new YCloudProvider();

        // Check if YCloud is configured
        const isReady = await ycloud.isReady();
        if (!isReady) {
            return NextResponse.json(
                { success: false, error: 'YCloud is not configured. Please add API key and Phone ID in settings.' },
                { status: 400 }
            );
        }

        // Send template message
        const result = await ycloud.sendTemplateMessage(
            phone,
            templateName,
            variables,
            'pt_BR'
        );

        if (result.success) {
            return NextResponse.json({
                success: true,
                messageId: result.messageId
            });
        } else {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('YCloud send error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
