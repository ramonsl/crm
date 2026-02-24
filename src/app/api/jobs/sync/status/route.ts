import { linkedInJobAutomationService } from '@/services/LinkedInJobAutomationService';
import { requireAuth } from '@/lib/auth/requireAuth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
    } catch (error) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSyncing = linkedInJobAutomationService.isSyncing;
    const logs = linkedInJobAutomationService.syncLogs;
    const lastStats = linkedInJobAutomationService.lastSyncStats;

    return NextResponse.json({
        success: true,
        isSyncing,
        logs,
        lastStats,
    });
}
