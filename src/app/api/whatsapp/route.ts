import { getErrorMessage } from '@/lib/types';
import { NextResponse, NextRequest } from 'next/server';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, UnauthorizedError } from '@/lib/auth/requireAuth';
import { rateLimit, getClientIdentifier } from '@/lib/rateLimit';

// Force this route to be dynamic to avoid caching status
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const provider = await WhatsAppProviderFactory.getProvider('baileys');
        const status = await provider.getStatus();
        const providerType = WhatsAppProviderFactory.getCurrentProviderType();

        return NextResponse.json({
            ...status,
            provider: providerType,
            reconnectAttempts: (global as any).whatsappReconnectAttempts || 0,
            lastDisconnect: (global as any).whatsappLastDisconnect || null,
            healthCheckActive: (global as any).whatsappHealthCheckTimer !== null,
            restartHistory: (global as any).whatsappRestartHistory?.length || 0,
        });
    } catch (error) {
        console.error('[API /api/whatsapp GET] Error:', error);
        return NextResponse.json({
            status: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

export async function POST(req: NextRequest) {
    try {
        // Require authentication for all WhatsApp actions
        const user = await requireAuth(req);

        // Rate limit - 20 requests per minute
        const identifier = getClientIdentifier(req, user);
        const rateLimitResult = rateLimit(identifier, 20, 60000);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Limite de mensagens excedido. Aguarde 1 minuto.' },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { action } = body;

        // Get provider instance
        const providerType = body.provider || 'baileys';
        const provider = await WhatsAppProviderFactory.getProvider(providerType);

        if (action === 'connect') {
            // Start initialization in background (don't await)
            provider.initialize().catch((error) => {
                console.error('[API /api/whatsapp] Error initializing provider:', error);
            });

            return NextResponse.json({
                message: 'Initializing',
                provider: WhatsAppProviderFactory.getCurrentProviderType()
            });
        }

        if (action === 'send') {
            let { phone, message } = body;

            // Check if WhatsApp is connected
            const status = await provider.getStatus();
            if (status.status !== 'ready') {
                const statusMessages: Record<string, string> = {
                    'disconnected': 'WhatsApp desconectado. Por favor, conecte-se na página WhatsApp.',
                    'connecting': 'WhatsApp está inicializando. Aguarde alguns segundos e tente novamente.',
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

                const sendResult = await provider.sendTextMessage(phone, message);

                if (!sendResult.success) {
                    return NextResponse.json({
                        error: sendResult.error || 'Erro ao enviar mensagem'
                    }, { status: 500 });
                }

                // Save to messages table if we have a lead CPF
                if (lead && lead.cpf) {
                    try {
                        const messageId = sendResult.messageId || uuidv4();

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

                return NextResponse.json({ success: true, messageId: sendResult.messageId });
            } catch (error: unknown) {
                return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
            }
        }

        if (action === 'disconnect') {
            await provider.logout();
            return NextResponse.json({ message: 'Disconnected', status: 'disconnected' });
        }

        if (action === 'reset') {
            await provider.clearSession(true);
            return NextResponse.json({ message: 'Session reset', status: 'disconnected' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('[API /api/whatsapp POST] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        // Require authentication
        await requireAuth(req);

        const provider = await WhatsAppProviderFactory.getProvider('baileys');
        await provider.logout();

        return NextResponse.json({ message: 'Disconnected', status: 'disconnected' });
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('[API /api/whatsapp DELETE] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
