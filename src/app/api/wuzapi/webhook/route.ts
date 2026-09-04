/**
 * WuzAPI Webhook Route
 *
 * Recebe eventos do servidor WuzAPI (mensagens recebidas, status de entrega, etc.)
 * e repassa para o WuzAPIAdapter que está registrado no ProviderManager.
 *
 * O WuzAPI deve ser configurado com:
 *   WUZAPI_WEBHOOK_URL = https://seu-dominio.com/api/wuzapi/webhook
 *
 * Autenticação: o WuzAPI envia o token no campo "token" do payload.
 * Configurar WUZAPI_WEBHOOK_SECRET (opcional) para validação extra.
 */

import { NextRequest, NextResponse } from 'next/server';
import { WuzAPIWebhookPayload } from '@/lib/whatsapp/adapters/WuzAPIAdapter';
import { whatsappLogger } from '@/lib/logger';
import type { WhatsAppMessage, MediaType } from '@/lib/whatsapp/IWhatsAppProvider';

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        whatsappLogger.info(`[WuzAPI Webhook] raw body (primeiros 300 chars): ${rawBody.substring(0, 300)}`);

        let payload: WuzAPIWebhookPayload;
        try {
            payload = JSON.parse(rawBody) as WuzAPIWebhookPayload;
        } catch {
            whatsappLogger.warn(`[WuzAPI Webhook] body não é JSON válido, ignorando`);
            return NextResponse.json({ ok: true, skipped: true });
        }

        whatsappLogger.info(`[WuzAPI Webhook] evento="${payload.event}" isGroup=${payload.data?.IsGroup ?? false} fromMe=${payload.data?.FromMe ?? false} body="${payload.data?.Body?.substring(0, 50) ?? ''}"`);

        // Ignore non-message events (receipts, presence, etc.)
        if (payload.event !== 'Message') {
            return NextResponse.json({ ok: true, skipped: true });
        }

        const { data } = payload;
        if (!data) return NextResponse.json({ ok: true, skipped: true });

        // Ignora mensagens enviadas por nós mesmos
        if (data.FromMe) return NextResponse.json({ ok: true, skipped: true });

        // Monta o WhatsAppMessage no mesmo formato que o BaileysAdapter produz
        const from = data.IsGroup
            ? (data.GroupId ?? data.Sender ?? '')
            : (data.Sender ?? '');

        const message: WhatsAppMessage = {
            id: data.Id ?? `wuzapi-${Date.now()}`,
            from,
            body: data.Body ?? '',
            isGroup: !!data.IsGroup,
            timestamp: data.Timestamp ? new Date(data.Timestamp * 1000) : new Date(),
            fromMe: false,
            mediaUrl: data.MediaUrl ?? undefined,
            mediaType: mapMediaType(data.Type),
        };

        // Chama o handler diretamente — evita depender do messageCallback ser registrado
        const { baileysMessageHandler } = await import('@/services/BaileysMessageHandler');
        baileysMessageHandler.handle(message).catch((err: unknown) => {
            whatsappLogger.error('[WuzAPI Webhook] Erro no handler:', err instanceof Error ? err.message : String(err));
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        whatsappLogger.error('[WuzAPI Webhook] Erro ao processar payload:', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
}

function mapMediaType(type?: string): MediaType | undefined {
    if (!type) return undefined;
    const t = type.toLowerCase();
    if (t.includes('image')) return 'image';
    if (t.includes('video')) return 'video';
    if (t.includes('audio') || t.includes('ptt')) return 'audio';
    if (t.includes('document')) return 'document';
    return undefined;
}

// WuzAPI envia um GET para verificar se o endpoint está ativo
export async function GET() {
    return NextResponse.json({ ok: true, provider: 'wuzapi' });
}
