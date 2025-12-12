/**
 * Auto-Replies API Routes
 * GET /api/auto-replies - List all auto-replies
 * POST /api/auto-replies - Create new auto-reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoReplyRepository } from '@/lib/repositories/AutoReplyRepository';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('active') === 'true';

        const replies = activeOnly
            ? await autoReplyRepository.findActive()
            : await autoReplyRepository.findAll();

        return NextResponse.json(replies);
    } catch (error) {
        console.error('[API] Error fetching auto-replies:', error);
        return NextResponse.json(
            { error: 'Failed to fetch auto-replies' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validation
        if (!body.name || !body.intent_description || !body.response_template) {
            return NextResponse.json(
                { error: 'Missing required fields: name, intent_description, response_template' },
                { status: 400 }
            );
        }

        const newReply = await autoReplyRepository.create({
            name: body.name,
            intent_description: body.intent_description,
            example_messages: body.example_messages || [],
            response_template: body.response_template,
            is_active: body.is_active ?? true,
            priority: body.priority ?? 0,
            confidence_threshold: body.confidence_threshold ?? 0.70
        });

        return NextResponse.json(newReply, { status: 201 });
    } catch (error) {
        console.error('[API] Error creating auto-reply:', error);
        return NextResponse.json(
            { error: 'Failed to create auto-reply' },
            { status: 500 }
        );
    }
}
