/**
 * WuzAPI Webhook Route
 *
 * O WuzAPI envia um POST com Content-Type: application/x-www-form-urlencoded
 * com dois campos:
 *   instanceName=<nome>
 *   jsonData=<URL-encoded JSON>
 *
 * O JSON dentro de jsonData segue o formato Baileys com estrutura:
 * {
 *   "event": {
 *     "Info": {
 *       "Chat": "<JID do chat ou grupo>",
 *       "Sender": "<JID do remetente>",
 *       "SenderAlt": "<JID alternativo>",
 *       "IsFromMe": bool,
 *       "IsGroup": bool,
 *       "Timestamp": <unix timestamp>
 *     },
 *     "Message": { ... }
 *   },
 *   "type": "message" | ...
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappLogger } from '@/lib/logger';
import type { WhatsAppMessage } from '@/lib/whatsapp/IWhatsAppProvider';

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        whatsappLogger.info(`[WuzAPI Webhook] raw body (primeiros 400 chars): ${rawBody.substring(0, 400)}`);

        // Parse form-encoded body
        const params = new URLSearchParams(rawBody);
        const instanceName = params.get('instanceName') ?? '(unknown)';
        const jsonDataRaw = params.get('jsonData');

        if (!jsonDataRaw) {
            // Tenta parsear como JSON direto (caso o formato mude futuramente)
            try {
                const direct = JSON.parse(rawBody);
                whatsappLogger.info(`[WuzAPI Webhook] JSON direto: type="${direct?.type}" event keys=${Object.keys(direct?.event ?? {}).join(',')}`);
                return await handleEventObject(direct, instanceName);
            } catch {
                whatsappLogger.warn(`[WuzAPI Webhook] body não tem jsonData e não é JSON — ignorando`);
                return NextResponse.json({ ok: true, skipped: true });
            }
        }

        let payload: Record<string, unknown>;
        try {
            payload = JSON.parse(jsonDataRaw) as Record<string, unknown>;
        } catch {
            whatsappLogger.warn(`[WuzAPI Webhook] jsonData não é JSON válido, ignorando. jsonData(200)=${jsonDataRaw.substring(0, 200)}`);
            return NextResponse.json({ ok: true, skipped: true });
        }

        whatsappLogger.info(`[WuzAPI Webhook] instance="${instanceName}" type="${payload?.type}" eventKeys=${Object.keys((payload?.event as object) ?? {}).join(',')}`);

        return await handleEventObject(payload, instanceName);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        whatsappLogger.error('[WuzAPI Webhook] Erro ao processar payload:', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
}

async function handleEventObject(payload: Record<string, unknown>, instanceName: string): Promise<NextResponse> {
    // WuzAPI wraps the Baileys event inside payload.event
    const eventData = payload?.event as Record<string, unknown> | undefined;

    if (!eventData) {
        whatsappLogger.warn(`[WuzAPI Webhook] payload sem campo 'event', ignorando. Keys: ${Object.keys(payload).join(',')}`);
        return NextResponse.json({ ok: true, skipped: true });
    }

    // A estrutura Baileys dentro do jsonData:
    // payload.type = "message"
    // payload.event.Info = { Chat, Sender, SenderAlt, IsFromMe, IsGroup, Timestamp, Id }
    // payload.event.Message = { conversation, imageMessage, ... }

    const info = eventData.Info as Record<string, unknown> | undefined;
    const msgObj = eventData.Message as Record<string, unknown> | undefined;

    if (!info) {
        whatsappLogger.warn(`[WuzAPI Webhook] event sem 'Info', ignorando. EventKeys: ${Object.keys(eventData).join(',')}`);
        return NextResponse.json({ ok: true, skipped: true });
    }

    whatsappLogger.info(`[WuzAPI Webhook] Info: Chat="${info.Chat}" IsGroup=${info.IsGroup} IsFromMe=${info.IsFromMe} Sender="${info.Sender}"`);

    // Ignora mensagens enviadas por nós mesmos
    if (info.IsFromMe) {
        return NextResponse.json({ ok: true, skipped: true });
    }

    // Extrai o texto da mensagem
    const body = extractMessageText(msgObj);

    const from = info.IsGroup
        ? String(info.Chat ?? '')
        : String(info.SenderAlt ?? info.Sender ?? '');

    const timestamp = info.Timestamp
        ? new Date(Number(info.Timestamp) * 1000)
        : new Date();

    const id = String(info.Id ?? `wuzapi-${instanceName}-${Date.now()}`);

    const message: WhatsAppMessage = {
        id,
        from,
        body,
        isGroup: !!info.IsGroup,
        timestamp,
        fromMe: false,
        mediaUrl: undefined,
        mediaType: undefined,
    };

    whatsappLogger.info(`[WuzAPI Webhook] processando mensagem id="${id}" from="${from}" body="${body.substring(0, 80)}"`);

    const { baileysMessageHandler } = await import('@/services/BaileysMessageHandler');
    baileysMessageHandler.handle(message).catch((err: unknown) => {
        whatsappLogger.error('[WuzAPI Webhook] Erro no handler:', err instanceof Error ? err.message : String(err));
    });

    return NextResponse.json({ ok: true });
}

function extractMessageText(msg: Record<string, unknown> | undefined): string {
    if (!msg) return '';
    // Texto simples
    if (typeof msg.conversation === 'string') return msg.conversation;
    // Caption de imagem/vídeo/documento
    const ext = msg.extendedTextMessage as Record<string, unknown> | undefined;
    if (typeof ext?.text === 'string') return ext.text;
    // Imagem com legenda
    const img = msg.imageMessage as Record<string, unknown> | undefined;
    if (typeof img?.caption === 'string') return img.caption;
    // Vídeo com legenda
    const vid = msg.videoMessage as Record<string, unknown> | undefined;
    if (typeof vid?.caption === 'string') return vid.caption;
    return '';
}

// WuzAPI envia um GET para verificar se o endpoint está ativo
export async function GET() {
    return NextResponse.json({ ok: true, provider: 'wuzapi' });
}
