import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';

// GET /api/chat/messages?cpf=xxx&limit=50&offset=0
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const afterId = parseInt(searchParams.get('after_id') || '0');

        if (!cpf) {
            return NextResponse.json({ error: 'CPF is required' }, { status: 400 });
        }

        // Verify contact exists
        const contact = db.prepare('SELECT cpf FROM leads WHERE cpf = ?').get(cpf);
        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        let messages;
        if (afterId > 0) {
            // Fetch only new messages
            messages = db.prepare(`
                SELECT id, message_id, direction, body, media_url, media_type, timestamp, status
                FROM messages
                WHERE contact_cpf = ? AND id > ?
                ORDER BY timestamp ASC
            `).all(cpf, afterId);
        } else {
            // Fetch initial history (reversed for UI)
            messages = db.prepare(`
                SELECT id, message_id, direction, body, media_url, media_type, timestamp, status
                FROM messages
                WHERE contact_cpf = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `).all(cpf, limit, offset);

            // Reverse to show oldest first if it's the initial load
            messages = messages.reverse();
        }

        // Get total count
        const totalResult = db.prepare('SELECT COUNT(*) as total FROM messages WHERE contact_cpf = ?').get(cpf) as { total: number };

        return NextResponse.json({
            messages: messages, // Order is already handled above
            total: totalResult.total,
            hasMore: offset + limit < totalResult.total
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
