import { NextResponse } from 'next/server';
import { YCloudTemplateService } from '@/services/YCloudTemplateService';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function POST(req: Request) {
    try {
        await requireAuth(req as any);
        const service = new YCloudTemplateService();
        await service.syncAllFromYCloud();

        return NextResponse.json({ success: true, message: 'Templates synced successfully' });
    } catch (error: any) {
        console.error('[API /api/ycloud/templates/sync POST] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
