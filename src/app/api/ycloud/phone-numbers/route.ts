
import { NextResponse } from 'next/server';
import { SettingRepository } from '@/lib/repositories/SettingRepository';

export async function POST(req: Request) {
    try {
        let { apiKey, wabaId } = await req.json();

        const settingRepo = new SettingRepository();

        // If API Key is masked or missing, try to get from DB
        if (!apiKey || apiKey.startsWith('***')) {
            const storedKey = await settingRepo.get('ycloud_api_key');
            if (storedKey) {
                apiKey = storedKey;
            }
        }

        if (!apiKey || !wabaId) {
            return NextResponse.json({ error: 'API Key e WABA ID são obrigatórios' }, { status: 400 });
        }

        // Use the same endpoint we verified in the script
        const url = `https://api.ycloud.com/v2/whatsapp/phoneNumbers?wabaId=${wabaId}&page=1&limit=20`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[YCloud Phone Sync] Error:', errorText);
            return NextResponse.json({
                error: `Erro ao buscar números: ${response.statusText}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();

        // Map to a clean structure for the frontend
        const numbers = (data.items || []).map((item: any) => ({
            id: item.id,
            phoneNumber: item.phoneNumber,
            name: item.name || item.phoneNumber,
            status: item.status,
            qualityRating: item.qualityRating
        }));

        return NextResponse.json({ numbers });

    } catch (error) {
        console.error('[YCloud Phone Sync] Exception:', error);
        return NextResponse.json({ error: 'Erro interno ao buscar números' }, { status: 500 });
    }
}
