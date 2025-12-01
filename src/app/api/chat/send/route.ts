import { NextResponse, NextRequest } from 'next/server';
import { sendMessage } from '@/lib/whatsapp';
import db from '@/lib/db';

// POST /api/chat/send
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cpf, message, mediaUrl, mediaType } = body;

        if (!cpf || !message) {
            return NextResponse.json({ error: 'CPF and message are required' }, { status: 400 });
        }

        // Get contact phone
        const contact = db.prepare('SELECT telefone FROM leads WHERE cpf = ?').get(cpf) as { telefone: string } | undefined;

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Send via WhatsApp
        const result = await sendMessage(contact.telefone, message, mediaUrl, mediaType);

        // Store in database
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO messages (contact_cpf, message_id, direction, body, media_url, status, timestamp)
            VALUES (?, ?, 'outgoing', ?, ?, 'sent', CURRENT_TIMESTAMP)
        `);

        stmt.run(cpf, result.id, message, mediaUrl || null);

        return NextResponse.json({ success: true, messageId: result.id });
    } catch (error: any) {
        console.error('Error sending message:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
