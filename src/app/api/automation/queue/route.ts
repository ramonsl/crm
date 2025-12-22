/**
 * API: /api/automation/queue
 * 
 * CRUD for queue automation configuration.
 * Allows configuring automatic message sending when queue is empty.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queueAutomationService } from '@/services/QueueAutomationService';
import type { MessageType } from '@/types/queueAutomation';

interface UpdateConfigBody {
    templateId?: number | null;
    targetStatus?: string | null;
    messageType?: MessageType;
    isActive?: boolean;
}

/**
 * GET /api/automation/queue
 * Get current automation configuration and status
 */
export async function GET() {
    try {
        const [config, status] = await Promise.all([
            queueAutomationService.getConfig(),
            queueAutomationService.getStatus()
        ]);

        return NextResponse.json({
            config: config || {
                templateId: null,
                targetStatus: null,
                messageType: 'fixed',
                isActive: false,
                startHour: 8,
                endHour: 21
            },
            status
        });
    } catch (error) {
        console.error('[API /api/automation/queue GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch queue automation config' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/automation/queue
 * Update queue automation configuration
 * Body: { templateId?: number | null, messageType?: 'fixed' | 'ai', isActive?: boolean }
 */
export async function POST(req: NextRequest) {
    try {
        const body: UpdateConfigBody = await req.json();

        // Validate messageType if provided
        if (body.messageType && !['fixed', 'ai'].includes(body.messageType)) {
            return NextResponse.json(
                { error: 'messageType must be "fixed" or "ai"' },
                { status: 400 }
            );
        }

        // Update configuration
        await queueAutomationService.updateConfig({
            templateId: body.templateId,
            targetStatus: body.targetStatus,
            messageType: body.messageType,
            isActive: body.isActive
        });

        // Return updated config
        const config = await queueAutomationService.getConfig();

        return NextResponse.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('[API /api/automation/queue POST] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update queue automation config' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/automation/queue
 * Reset automation log (allows re-sending to all leads)
 */
export async function DELETE() {
    try {
        await queueAutomationService.resetLog();

        return NextResponse.json({
            success: true,
            message: 'Automation log reset successfully'
        });
    } catch (error) {
        console.error('[API /api/automation/queue DELETE] Error:', error);
        return NextResponse.json(
            { error: 'Failed to reset automation log' },
            { status: 500 }
        );
    }
}
