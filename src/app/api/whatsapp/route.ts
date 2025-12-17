import { getErrorMessage } from '@/lib/types';

import { NextResponse } from 'next/server';
import { getClient, getStatus, logout, sendMessage } from '@/lib/whatsapp';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    const status = getStatus();

    return NextResponse.json({
        ...status,
        reconnectAttempts: (global as any).whatsappReconnectAttempts || 0,
        lastDisconnect: (global as any).whatsappLastDisconnect || null,
        healthCheckActive: (global as any).whatsappHealthCheckTimer !== null,
        restartHistory: (global as any).whatsappRestartHistory?.length || 0,
    });
}

export async function POST(req: Request) {
    const body = await req.json();
    const { action } = body;

    if (action === 'connect') {
        getClient();
        return NextResponse.json({ message: 'Initializing' });
    }

    if (action === 'send') {
        let { phone, message } = body;

        // Check if WhatsApp is connected
        const status = getStatus();
        if (status.status !== 'ready') {
            const statusMessages: Record<string, string> = {
                'disconnected': 'WhatsApp desconectado. Por favor, conecte-se na página WhatsApp.',
                'initializing': 'WhatsApp está inicializando. Aguarde alguns segundos e tente novamente.',
                'qr': 'WhatsApp aguardando leitura do QR Code. Escaneie o código na página WhatsApp.'
            };
            const errorMessage = statusMessages[status.status] || `WhatsApp não está pronto (${status.status})`;
            return NextResponse.json({
                error: errorMessage,
                whatsappStatus: status.status,
                needsConnection: true
            }, { status: 400 });
        }

        // Normalize phone
        const digitsOnly = phone.replace(/\D/g, '');
        if ((digitsOnly.length === 10 || digitsOnly.length === 11) && !digitsOnly.startsWith('55')) {
            phone = '55' + digitsOnly;
            console.log(`[API] Normalized phone: ${digitsOnly} → ${phone}`);
        }

        try {
            // Fetch lead name and CPF for substitution
            const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
            const result = await pool.query(
                'SELECT cpf, nome FROM leads WHERE telefone = $1 OR telefone = $2',
                [phone, phoneWithoutCountry]
            );
            const lead = result.rows[0];

            if (lead && lead.nome) {
                const firstName = lead.nome.trim().split(' ')[0];
                message = message
                    .replace(/{nome_completo}/g, lead.nome)
                    .replace(/{nome}/g, firstName);
            } else {
                message = message
                    .replace(/{nome_completo}/g, 'Visitante')
                    .replace(/{nome}/g, 'Visitante');
            }

            const sendResult = await sendMessage(phone, message);

            // Save to messages table if we have a lead CPF
            if (lead && lead.cpf) {
                try {
                    const messageId = typeof sendResult.id === 'object' && sendResult.id !== null
                        ? (sendResult.id as any)._serialized || String(sendResult.id)
                        : sendResult.id || uuidv4();

                    await pool.query(`
                        INSERT INTO messages (id, contact_phone, content, from_me, type, timestamp)
                        VALUES ($1, $2, $3, true, 'text', NOW())
                        ON CONFLICT (id) DO NOTHING
                    `, [messageId, lead.cpf, message]);
                    console.log(`[API] Message saved to DB for CPF ${lead.cpf}`);

                    await pool.query(`
                        UPDATE leads 
                        SET last_message = $1, 
                            last_message_time = NOW(),
                            updated_at = NOW()
                        WHERE cpf = $2
                    `, [message, lead.cpf]);
                    console.log(`[API] Lead updated with last message for CPF ${lead.cpf}`);

                } catch (dbError) {
                    console.error('[API] Error saving message to DB:', dbError);
                }
            } else {
                console.warn(`[API] Message sent but not saved to DB: No lead found for phone ${phone}`);
            }

            return NextResponse.json({ success: true, messageId: sendResult.id });
        } catch (error: unknown) {
            return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
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
