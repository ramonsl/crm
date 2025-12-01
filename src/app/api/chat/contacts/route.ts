import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';

// GET /api/chat/contacts - Get all contacts with last message preview
export async function GET(req: NextRequest) {
    try {
        const query = `
            SELECT 
                l.cpf,
                l.nome,
                l.telefone,
                l.email,
                l.status,
                l.unread_count,
                l.profile_image,
                m.body as last_message,
                m.timestamp as last_message_time,
                m.direction as last_message_direction
            FROM leads l
            LEFT JOIN (
                SELECT contact_cpf, body, timestamp, direction,
                       ROW_NUMBER() OVER (PARTITION BY contact_cpf ORDER BY timestamp DESC) as rn
                FROM messages
            ) m ON l.cpf = m.contact_cpf AND m.rn = 1
            ORDER BY m.timestamp DESC NULLS LAST, l.nome ASC
        `;

        const contacts = db.prepare(query).all();

        return NextResponse.json({ contacts });
    } catch (error) {
        console.error('Error fetching chat contacts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
