import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
    try {
        // Get total unread count
        const unreadResult = await pool.query('SELECT SUM(unread_count) as total FROM leads');
        const totalChatUnread = parseInt(unreadResult.rows[0]?.total || '0');

        // Get system notifications (create table if not exists)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_notifications (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                message TEXT,
                type TEXT DEFAULT 'info',
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const sysResult = await pool.query(`
            SELECT id, title, message, type, created_at, 'system' as source
            FROM system_notifications
            WHERE is_read = 0
            ORDER BY created_at DESC
        `);
        const systemNotifications = sysResult.rows;

        // Get details of unread messages
        const leadsResult = await pool.query(`
            SELECT nome, last_message, unread_count, cpf, last_message_time, 'chat' as source
            FROM leads 
            WHERE unread_count > 0 
            ORDER BY last_message_time DESC
        `);
        const unreadLeads = leadsResult.rows;

        const totalSystem = systemNotifications.length;
        const total = totalChatUnread + totalSystem;

        return NextResponse.json({
            total,
            notifications: [...systemNotifications, ...unreadLeads].sort((a: any, b: any) => {
                const dateA = new Date(a.created_at || a.last_message_time).getTime();
                const dateB = new Date(b.created_at || b.last_message_time).getTime();
                return dateB - dateA;
            })
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cpf } = body;

        if (!cpf) {
            return NextResponse.json({ error: 'CPF is required' }, { status: 400 });
        }

        await pool.query('UPDATE leads SET unread_count = 0 WHERE cpf = $1', [cpf]);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT() {
    try {
        // Mark all leads as read
        await pool.query('UPDATE leads SET unread_count = 0');

        // Mark all system notifications as read
        await pool.query('UPDATE system_notifications SET is_read = 1');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
