import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
    try {
        const result = await pool.query('SELECT key, value FROM settings');
        const rows = result.rows as { key: string; value: string }[];

        const settings: any = {};
        rows.forEach(row => {
            if (row.key === 'openai_api_key') settings.openaiApiKey = row.value;
            if (row.key === 'queue_min_delay') settings.minDelay = row.value;
            if (row.key === 'queue_max_delay') settings.maxDelay = row.value;
            if (row.key === 'meta_matriculas') settings.metaMatriculas = row.value;
            if (row.key === 'comercial_phone') settings.comercialPhone = row.value;
            if (row.key === 'comercial_name') settings.comercialName = row.value;
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
        const { openaiApiKey, minDelay, maxDelay, comercialPhone, comercialName } = body;

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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
