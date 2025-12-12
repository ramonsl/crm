/**
 * Auto-Reply Test API Route
 * POST /api/auto-replies/test - Test intent detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoReplyRepository } from '@/lib/repositories/AutoReplyRepository';
import { intentDetectionService } from '@/services/intentDetectionService';
import { autoReplyService } from '@/services/autoReplyService';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.message) {
            return NextResponse.json(
                { error: 'Missing required field: message' },
                { status: 400 }
            );
        }

        // Get active intents
        const activeIntents = await autoReplyRepository.findActive();
        if (activeIntents.length === 0) {
            return NextResponse.json({
                intent: null,
                confidence: 0,
                response: null,
                message: 'No active auto-replies configured'
            });
        }

        // Detect intent
        const detection = await intentDetectionService.detectIntent(
            body.message,
            activeIntents
        );

        if (!detection) {
            return NextResponse.json({
                intent: null,
                confidence: 0,
                response: null,
                message: 'No intent detected'
            });
        }

        // Find the auto-reply
        const autoReply = activeIntents.find(r => r.id === detection.autoReplyId);
        if (!autoReply) {
            return NextResponse.json({
                intent: detection.intent,
                confidence: detection.confidence,
                response: null,
                message: 'Auto-reply not found'
            });
        }

        // Check threshold
        const meetsThreshold = detection.confidence >= autoReply.confidence_threshold;

        // Render response
        const response = meetsThreshold
            ? autoReplyService.renderTemplate(autoReply.response_template, {
                phone: '5511999999999',
                message: body.message,
                name: 'Teste'
            })
            : null;

        return NextResponse.json({
            intent: detection.intent,
            confidence: detection.confidence,
            threshold: autoReply.confidence_threshold,
            meetsThreshold,
            response,
            message: meetsThreshold
                ? 'Intent detected and would send response'
                : `Confidence (${detection.confidence}) below threshold (${autoReply.confidence_threshold})`
        });
    } catch (error) {
        console.error('[API] Error testing auto-reply:', error);
        return NextResponse.json(
            { error: 'Failed to test auto-reply', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
