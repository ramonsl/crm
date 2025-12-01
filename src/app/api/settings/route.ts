import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const stmt = db.prepare('SELECT key, value FROM settings');
        const rows = stmt.all() as { key: string; value: string }[];

        const settings: any = {};
        rows.forEach(row => {
            if (row.key === 'openai_api_key') settings.openaiApiKey = row.value;
            if (row.key === 'queue_min_delay') settings.minDelay = row.value;
            if (row.key === 'queue_max_delay') settings.maxDelay = row.value;
            if (row.key === 'meta_matriculas') settings.metaMatriculas = row.value;
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
        const { openaiApiKey, minDelay, maxDelay } = body;

        const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        if (openaiApiKey !== undefined) insert.run('openai_api_key', openaiApiKey);
        if (minDelay !== undefined) insert.run('queue_min_delay', minDelay.toString());
        if (maxDelay !== undefined) insert.run('queue_max_delay', maxDelay.toString());
        if (body.metaMatriculas !== undefined) insert.run('meta_matriculas', body.metaMatriculas.toString());

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
