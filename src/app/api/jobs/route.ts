/**
 * API Route: Job Sync & Dashboard
 * POST /api/jobs - Triggers sync manually
 * GET /api/jobs - Fetch dashboard metrics and latest jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { linkedInJobAutomationService } from '@/services/LinkedInJobAutomationService';
import { LinkedInJobRepository } from '@/lib/repositories/LinkedInJobRepository';
import { dbLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/requireAuth';

// Impede o Next.js de tentar gerar esta rota estaticamente no build.
// A rota depende de banco de dados e variáveis de ambiente em tempo de execução.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        await requireAuth(req);
    } catch (error) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    dbLogger.info('[API] Manually triggering job sync');

    try {
        const stats = await linkedInJobAutomationService.runSync();

        return NextResponse.json({
            success: true,
            message: 'Job sync completed',
            stats
        });
    } catch (error) {
        dbLogger.error('[API] Job sync failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/jobs
 * Returns detailed stats for the Jobs Dashboard.
 * Query params:
 *   - view=dashboard (default) - returns detailed stats + latest
 *   - limit=20 - number of recent jobs
 *   - offset=0 - pagination offset
 */
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
    } catch (error) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = new LinkedInJobRepository();
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        const [detailedStats, latestData] = await Promise.all([
            repo.getDetailedStats(),
            repo.getLatestPaginated(limit, offset)
        ]);

        return NextResponse.json({
            success: true,
            stats: detailedStats,
            latest: latestData.jobs,
            pagination: {
                total: latestData.total,
                limit,
                offset,
                hasMore: offset + limit < latestData.total
            }
        });
    } catch (error) {
        dbLogger.error('[API] Failed to fetch job stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
