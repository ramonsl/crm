import { getErrorMessage } from '@/lib/types';
import { NextResponse, NextRequest } from 'next/server';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';
import { WhatsAppProviderManager } from '@/lib/whatsapp/manager/WhatsAppProviderManager';
import { LeadRepository, WhatsAppRepository } from '@/lib/repositories';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, UnauthorizedError } from '@/lib/auth/requireAuth';
import { rateLimit, getClientIdentifier } from '@/lib/rateLimit';

// Force this route to be dynamic to avoid caching status
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const manager = WhatsAppProviderManager.getInstance();

        // 1. Get Official Status
        const officialProvider = manager.getOfficialProvider();
        const officialStatus = await officialProvider.getStatus(); // Usually 'connected' if config exists or 'disconnected'
        console.log('[API GET] Official Status:', officialStatus); // DEBUG

        // 2. Get Web Status
        const webProvider = await manager.getWebProvider();
        const webStatus = await webProvider.getStatus();

        return NextResponse.json({
            official: {
                status: officialStatus.status,
                ready: officialStatus.status === 'ready',
                configured: officialStatus.configured || officialStatus.status === 'ready'
            },
            web: {
                ...webStatus, // Includes qrCode, phoneNumber, etc.
                provider: (webProvider as any).constructor.name.includes('Baileys') ? 'baileys' : 'wwebjs' // Simplify identification
            },
            // Legacy top-level for backward compat (defaults to Web usually, or aggregate)
            status: webStatus.status, // Legacy UI primarily tracks Web QR status
            qrCode: webStatus.qrCode,
            phoneNumber: webStatus.phoneNumber,
            error: webStatus.error || officialStatus.error,
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
        const providerType = body.provider; // If undefined, getProvider uses current active
        const provider = await WhatsAppProviderFactory.getProvider(providerType);

        if (action === 'connect') {
            // Start initialization in background (don't await)
            provider.initialize().catch((error) => {
                console.error('[API /api/whatsapp] Error initializing provider:', error);
            });

            // Persist user preference for server restarts
            const resolvedType = WhatsAppProviderFactory.getCurrentProviderType();
            if (resolvedType) {
                await WhatsAppProviderFactory.persistProvider(resolvedType);
            }

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
                // Fetch lead name and CPF
                const leadRepository = new LeadRepository();
                const whatsAppRepository = new WhatsAppRepository();

                const lead = await leadRepository.findByPhone(phone);

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

                        await whatsAppRepository.saveMessage({
                            id: messageId,
                            contact_phone: lead.cpf,
                            content: message,
                            from_me: true,
                            type: 'text'
                        });
                        console.log(`[API] Message saved to DB for CPF ${lead.cpf}`);

                        await leadRepository.updateLastMessage(lead.cpf, message, new Date().toISOString());
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
            const manager = WhatsAppProviderManager.getInstance();
            manager.resetWebProvider();

            // Reinicia o provider para que o QR Code apareça imediatamente
            const newProvider = await manager.getWebProvider();
            newProvider.initialize().catch((err: unknown) => {
                console.error('[API disconnect] Erro ao reinicializar provider após desconectar:', err);
            });

            return NextResponse.json({ message: 'Disconnected', status: 'disconnected' });
        }

        if (action === 'reset') {
            await provider.clearSession(true);
            // Don't reset manager here if we want auto-reconnect, 
            // but for a full reset that forces QR, we might want to?
            // "reset" usually means "restart service". "disconnect" means "logout".
            // If action is reset/restart, we usually want it to stay alive.
            return NextResponse.json({ message: 'Session reset', status: 'disconnected' });
        }

        if (action === 'sync-history') {
            const { phone } = body;
            if (!phone) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 });

            // Trigger sync in background or await if small
            await provider.syncChatHistory(phone);
            return NextResponse.json({ success: true, message: 'Sincronização iniciada' });
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

        const provider = await WhatsAppProviderFactory.getProvider();
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
