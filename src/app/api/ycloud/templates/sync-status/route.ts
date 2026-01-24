import { NextResponse } from 'next/server';
import { YCloudTemplateService } from '@/services/YCloudTemplateService';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function POST(req: Request) {
    try {
        await requireAuth(req as any);
        // For now, syncTemplates handles both logic, but we could split status check optimization here
        const service = new YCloudTemplateService();
        // Check statuses of pending templates
        await service.syncStatuses();

        return NextResponse.json({ success: true, message: 'Template statuses synced' });
    } catch (error: any) {
        console.error('[API /api/ycloud/templates/sync-status POST] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
