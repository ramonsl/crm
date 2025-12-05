import { NextResponse } from 'next/server';
import { getClient, getStatus, logout, sendMessage } from '@/lib/whatsapp';
import db from '@/lib/db';

export async function GET() {
    const status = getStatus();

    // Add reconnection and health check info
    return NextResponse.json({
        ...status,
        reconnectAttempts: global.whatsappReconnectAttempts || 0,
        lastDisconnect: global.whatsappLastDisconnect || null,
        healthCheckActive: global.whatsappHealthCheckTimer !== null,
        restartHistory: global.whatsappRestartHistory?.length || 0,
    });
}

export async function POST(req: Request) {
    const body = await req.json();
    const { action } = body;

    if (action === 'connect') {
        getClient(); // Triggers initialization if not exists
        return NextResponse.json({ message: 'Initializing' });
    }

    if (action === 'send') {
        let { phone, message } = body;
        try {
            // Fetch lead name for substitution
            const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
            const stmt = db.prepare('SELECT nome FROM leads WHERE telefone = ? OR telefone = ?');
            const lead = stmt.get(phone, phoneWithoutCountry) as { nome: string } | undefined;

            if (lead && lead.nome) {
                const firstName = lead.nome.trim().split(' ')[0];
                message = message
                    .replace(/{nome_completo}/g, lead.nome)
                    .replace(/{nome}/g, firstName);
            } else {
                // Fallback if name not found or empty
                message = message
                    .replace(/{nome_completo}/g, 'Visitante')
                    .replace(/{nome}/g, 'Visitante');
            }

            await sendMessage(phone, message);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    if (action === 'disconnect') {
        await logout();
        return NextResponse.json({ message: 'Disconnected', status: 'disconnected' });
    }

    if (action === 'reset') {
        const { resetSession } = await import('@/lib/whatsapp');
        await resetSession();
        return NextResponse.json({ message: 'Session reset', status: 'disconnected' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function DELETE() {
    await logout();
    return NextResponse.json({ message: 'Disconnected', status: 'disconnected' });
}
