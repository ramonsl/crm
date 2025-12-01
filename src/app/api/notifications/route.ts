import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        // Get total unread count
        const result = db.prepare('SELECT SUM(unread_count) as total FROM leads').get() as any;
        const totalChatUnread = result.total || 0;

        // Get system notifications
        const systemNotifications = db.prepare(`
            SELECT id, title, message, type, created_at, 'system' as source
            FROM system_notifications
            WHERE is_read = 0
            ORDER BY created_at DESC
        `).all();

        // Get details of unread messages
        const unreadLeads = db.prepare(`
            SELECT nome, last_message, unread_count, cpf, last_message_time, 'chat' as source
            FROM leads 
            WHERE unread_count > 0 
            ORDER BY last_message_time DESC
        `).all();

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

        const stmt = db.prepare('UPDATE leads SET unread_count = 0 WHERE cpf = ?');
        stmt.run(cpf);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT() {
    try {
        // Mark all leads as read
        const leadsStmt = db.prepare('UPDATE leads SET unread_count = 0');
        leadsStmt.run();

        // Mark all system notifications as read
        const sysStmt = db.prepare('UPDATE system_notifications SET is_read = 1');
        sysStmt.run();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
