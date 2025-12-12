/**
 * Auto-Reply Toggle API Route
 * POST /api/auto-replies/[id]/toggle - Toggle active status
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoReplyRepository } from '@/lib/repositories/AutoReplyRepository';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idParam } = await params;
        const id = parseInt(idParam);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: 'Invalid ID' },
                { status: 400 }
            );
        }

        const updated = await autoReplyRepository.toggleActive(id);
        if (!updated) {
            return NextResponse.json(
                { error: 'Auto-reply not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('[API] Error toggling auto-reply:', error);
        return NextResponse.json(
            { error: 'Failed to toggle auto-reply' },
            { status: 500 }
        );
    }
}
