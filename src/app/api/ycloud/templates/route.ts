import { NextResponse } from 'next/server';
import { YCloudTemplateRepository } from '@/lib/repositories/YCloudTemplateRepository';
import { requireAuth } from '@/lib/auth/requireAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await requireAuth(req as any);
        const repo = new YCloudTemplateRepository();
        const templates = await repo.findAll();

        return NextResponse.json(templates);
    } catch (error: any) {
        console.error('[API /api/ycloud/templates GET] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
