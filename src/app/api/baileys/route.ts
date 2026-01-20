/**
 * Baileys WhatsApp API Route
 * 
 * Test endpoint for Baileys integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';

// GET /api/baileys - Get status or initialize
export async function GET(request: NextRequest) {
    const action = request.nextUrl.searchParams.get('action');

    try {
        const provider = await WhatsAppProviderFactory.getProvider();

        switch (action) {
            case 'init':
                await provider.initialize();
                return NextResponse.json({ success: true, message: 'Provider initialized', status: await provider.getStatus() });

            case 'restart':
                await provider.restart();
                return NextResponse.json({ success: true, message: 'Provider restarted', status: await provider.getStatus() });

            case 'logout':
                await provider.logout();
                return NextResponse.json({ success: true, message: 'Logged out' });

            case 'reset':
                await provider.clearSession();
                return NextResponse.json({ success: true, message: 'Session cleared' });

            default:
                return NextResponse.json({ success: true, status: await provider.getStatus() });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// POST /api/baileys - Send message
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, message, mediaUrl } = body;

        if (!phone || !message) {
            return NextResponse.json(
                { success: false, error: 'phone and message are required' },
                { status: 400 }
            );
        }

        const provider = await WhatsAppProviderFactory.getProvider();
        const result = await provider.sendMessage(phone, message, mediaUrl);
        return NextResponse.json({ success: true, result });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
