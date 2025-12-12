/**
 * Auto-Reply Stats API Route
 * GET /api/auto-replies/stats - Get usage statistics
 */

import { NextResponse } from 'next/server';
import { autoReplyRepository } from '@/lib/repositories/AutoReplyRepository';

export async function GET() {
    try {
        const stats = await autoReplyRepository.getStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error('[API] Error fetching stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch statistics' },
            { status: 500 }
        );
    }
}
