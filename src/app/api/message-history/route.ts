import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');

        if (!cpf) {
            return NextResponse.json({ error: 'CPF is required' }, { status: 400 });
        }

        const stmt = db.prepare(`
            SELECT 
                id,
                template_id,
                template_name,
                message_content,
                sent_at,
                status
            FROM message_history
            WHERE contact_cpf = ?
            ORDER BY sent_at DESC
        `);

        const history = stmt.all(cpf);

        return NextResponse.json({ history });
    } catch (error) {
        console.error('Error fetching message history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
