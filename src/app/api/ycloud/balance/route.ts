import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { SettingRepository } from '@/lib/repositories/SettingRepository';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await requireAuth(req as any);

        const settingRepo = new SettingRepository();
        const apiKey = await settingRepo.get('ycloud_api_key');

        if (!apiKey) {
            return NextResponse.json({ error: 'YCloud API Key not configured' }, { status: 400 });
        }

        const response = await fetch('https://api.ycloud.com/v2/balance', {
            method: 'GET',
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[YCloud Balance] Error:', errorText);
            return NextResponse.json({ error: `Failed to fetch balance: ${response.statusText}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('[API /api/ycloud/balance GET] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
