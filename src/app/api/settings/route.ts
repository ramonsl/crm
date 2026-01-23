import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
    try {
        const result = await pool.query('SELECT key, value FROM settings');
        const rows = result.rows as { key: string; value: string }[];

        const settings: Record<string, string> = {};
        rows.forEach(row => {
            if (row.key === 'openai_api_key') {
                settings.openaiApiKey = row.value ? `sk-...${row.value.slice(-4)}` : '';
            }
            if (row.key === 'queue_min_delay') settings.minDelay = row.value;
            if (row.key === 'queue_max_delay') settings.maxDelay = row.value;
            if (row.key === 'meta_matriculas') settings.metaMatriculas = row.value;
            if (row.key === 'comercial_phone') settings.comercialPhone = row.value;
            if (row.key === 'comercial_name') settings.comercialName = row.value;
            // YCloud settings
            if (row.key === 'bulk_send_provider') settings.bulkSendProvider = row.value;
            if (row.key === 'ycloud_api_key') {
                settings.yCloudApiKey = row.value ? `***${row.value.slice(-4)}` : '';
            }
            if (row.key === 'ycloud_waba_id') settings.yCloudWabaId = row.value;
            if (row.key === 'ycloud_phone_id') settings.yCloudPhoneId = row.value;
            if (row.key === 'ycloud_phone_number') settings.yCloudPhoneNumber = row.value;
            if (row.key === 'whatsapp_provider') settings.whatsappProvider = row.value;
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { openaiApiKey, minDelay, maxDelay, comercialPhone, comercialName, whatsappProvider } = body;

        const upsert = async (key: string, value: string) => {
            await pool.query(`
                INSERT INTO settings (key, value) 
                VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [key, value]);
        };

        if (openaiApiKey !== undefined) await upsert('openai_api_key', openaiApiKey);
        if (minDelay !== undefined) await upsert('queue_min_delay', minDelay.toString());
        if (maxDelay !== undefined) await upsert('queue_max_delay', maxDelay.toString());
        if (body.metaMatriculas !== undefined) await upsert('meta_matriculas', body.metaMatriculas.toString());
        if (comercialPhone !== undefined) await upsert('comercial_phone', comercialPhone);
        if (comercialName !== undefined) await upsert('comercial_name', comercialName);
        if (whatsappProvider !== undefined) await upsert('whatsapp_provider', whatsappProvider);

        // YCloud settings
        if (body.bulk_send_provider !== undefined) await upsert('bulk_send_provider', body.bulk_send_provider);
        if (body.ycloud_api_key !== undefined) await upsert('ycloud_api_key', body.ycloud_api_key);
        if (body.ycloud_waba_id !== undefined) await upsert('ycloud_waba_id', body.ycloud_waba_id);
        if (body.ycloud_phone_id !== undefined) await upsert('ycloud_phone_id', body.ycloud_phone_id);
        if (body.ycloud_phone_number !== undefined) await upsert('ycloud_phone_number', body.ycloud_phone_number);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

