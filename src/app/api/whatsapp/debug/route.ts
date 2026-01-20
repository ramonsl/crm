import { getErrorMessage } from '@/lib/types';

import { NextResponse } from 'next/server';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';

export async function GET() {
    try {
        const provider = await WhatsAppProviderFactory.getProvider();
        const status = await provider.getStatus();
        const client = (provider as any).client || null;

        // Check if message event listener is registered
        const listenerCount = client ? ((client as any).listenerCount?.('message') || 0) : 0;

        return NextResponse.json({
            status: status.status,
            hasClient: !!client,
            messageListeners: listenerCount,
            timestamp: new Date().toISOString()
        });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
