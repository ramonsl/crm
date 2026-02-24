import { linkedInJobAutomationService } from '@/services/LinkedInJobAutomationService';
import { dbLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/requireAuth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        await requireAuth(req);
    } catch (error) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (linkedInJobAutomationService.isSyncing) {
        return NextResponse.json({ error: 'Uma sincronização já está em andamento.' }, { status: 400 });
    }

    // Start sync in background intentionally disconnected from the HTTP response
    dbLogger.info('[API] Starting background job sync');

    // We don't await this so the HTTP connection returns immediately for the frontend to start polling
    linkedInJobAutomationService.runSync().catch(err => {
        console.error('Background sync crashed', err);
    });

    return NextResponse.json({
        success: true,
        message: 'Sync process started in the background.'
    });
}
