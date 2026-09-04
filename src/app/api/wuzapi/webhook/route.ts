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
import { WhatsAppProviderManager } from '@/lib/whatsapp/manager/WhatsAppProviderManager';
import { WuzAPIAdapter, WuzAPIWebhookPayload } from '@/lib/whatsapp/adapters/WuzAPIAdapter';
import { whatsappLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json() as WuzAPIWebhookPayload;

        whatsappLogger.info(`[WuzAPI Webhook] evento="${payload.event}" isGroup=${payload.data?.IsGroup ?? false} fromMe=${payload.data?.FromMe ?? false}`);

        // Ignore non-message events (receipts, presence, etc.)
        if (payload.event !== 'Message') {
            return NextResponse.json({ ok: true, skipped: true });
        }

        // Get the current web provider — must be WuzAPIAdapter
        const manager = WhatsAppProviderManager.getInstance();
        const webProvider = await manager.getWebProvider();

        if (!(webProvider instanceof WuzAPIAdapter)) {
            whatsappLogger.warn('[WuzAPI Webhook] Web provider atual não é WuzAPIAdapter. Webhook ignorado.');
            return NextResponse.json({ ok: false, error: 'WuzAPI provider not active' }, { status: 409 });
        }

        webProvider.dispatchWebhookPayload(payload);

        return NextResponse.json({ ok: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        whatsappLogger.error('[WuzAPI Webhook] Erro ao processar payload:', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
}

// WuzAPI envia um GET para verificar se o endpoint está ativo
export async function GET() {
    return NextResponse.json({ ok: true, provider: 'wuzapi' });
}
