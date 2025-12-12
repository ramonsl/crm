/**
 * Auto-Reply API Routes (by ID)
 * GET /api/auto-replies/[id] - Get auto-reply by ID
 * PUT /api/auto-replies/[id] - Update auto-reply
 * DELETE /api/auto-replies/[id] - Delete auto-reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoReplyRepository } from '@/lib/repositories/AutoReplyRepository';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: 'Invalid ID' },
                { status: 400 }
            );
        }

        const reply = await autoReplyRepository.findById(id);
        if (!reply) {
            return NextResponse.json(
                { error: 'Auto-reply not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(reply);
    } catch (error) {
        console.error('[API] Error fetching auto-reply:', error);
        return NextResponse.json(
            { error: 'Failed to fetch auto-reply' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: 'Invalid ID' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const updated = await autoReplyRepository.update(id, body);

        if (!updated) {
            return NextResponse.json(
                { error: 'Auto-reply not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('[API] Error updating auto-reply:', error);
        return NextResponse.json(
            { error: 'Failed to update auto-reply' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: 'Invalid ID' },
                { status: 400 }
            );
        }

        const deleted = await autoReplyRepository.delete(id);
        if (!deleted) {
            return NextResponse.json(
                { error: 'Auto-reply not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting auto-reply:', error);
        return NextResponse.json(
            { error: 'Failed to delete auto-reply' },
            { status: 500 }
        );
    }
}
