/**
 * Baileys WhatsApp API Route
 * 
 * Test endpoint for Baileys integration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    initializeBaileys,
    getBaileysStatus,
    sendBaileysMessage,
    restartBaileys,
    logoutBaileys,
    clearSession
} from '@/lib/whatsapp/baileys';

// GET /api/baileys - Get status or initialize
export async function GET(request: NextRequest) {
    const action = request.nextUrl.searchParams.get('action');

    try {
        switch (action) {
            case 'init':
                await initializeBaileys();
                return NextResponse.json({ success: true, message: 'Baileys initialized', status: getBaileysStatus() });

            case 'restart':
                await restartBaileys();
                return NextResponse.json({ success: true, message: 'Baileys restarted', status: getBaileysStatus() });

            case 'logout':
                await logoutBaileys();
                return NextResponse.json({ success: true, message: 'Logged out' });

            case 'reset':
                await clearSession();
                return NextResponse.json({ success: true, message: 'Session cleared' });

            default:
                return NextResponse.json({ success: true, status: getBaileysStatus() });
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

        const result = await sendBaileysMessage(phone, message, mediaUrl);
        return NextResponse.json({ success: true, result });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
