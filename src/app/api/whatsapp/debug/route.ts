import { NextResponse } from 'next/server';
import { getClient, getStatus } from '@/lib/whatsapp';

export async function GET() {
    try {
        const status = getStatus();
        const client = getClient();

        // Check if message event listener is registered
        const listenerCount = (client as any).listenerCount?.('message') || 0;

        return NextResponse.json({
            status: status.status,
            hasClient: !!client,
            messageListeners: listenerCount,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
