import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/chat/messages?cpf=xxx&limit=50&offset=0
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const afterId = searchParams.get('after_id');

        if (!cpf) {
            return NextResponse.json({ error: 'CPF is required' }, { status: 400 });
        }

        // Verify contact exists
        const contactResult = await pool.query('SELECT cpf FROM leads WHERE cpf = $1', [cpf]);
        if (contactResult.rows.length === 0) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        let messages;
        if (afterId) {
            // Fetch only new messages after a specific timestamp or ID
            const result = await pool.query(`
                SELECT id, id as message_id, from_me, content as body, media_url, type as media_type, timestamp, 'sent' as status,
                       CASE WHEN from_me THEN 'outgoing' ELSE 'incoming' END as direction
                FROM messages
                WHERE contact_phone = $1 AND timestamp > (SELECT timestamp FROM messages WHERE id = $2)
                ORDER BY timestamp ASC
            `, [cpf, afterId]);
            messages = result.rows;
        } else {
            // Fetch initial history (reversed for UI)
            const result = await pool.query(`
                SELECT id, id as message_id, from_me, content as body, media_url, type as media_type, timestamp, 'sent' as status,
                       CASE WHEN from_me THEN 'outgoing' ELSE 'incoming' END as direction
                FROM messages
                WHERE contact_phone = $1
                ORDER BY timestamp DESC
                LIMIT $2 OFFSET $3
            `, [cpf, limit, offset]);
            messages = result.rows.reverse();
        }

        // Get total count
        const totalResult = await pool.query(
            'SELECT COUNT(*) as total FROM messages WHERE contact_phone = $1',
            [cpf]
        );
        const total = parseInt(totalResult.rows[0].total);

        return NextResponse.json({
            messages,
            total,
            hasMore: offset + limit < total
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
