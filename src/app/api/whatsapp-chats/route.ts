/**
 * GET /api/whatsapp-chats
 * 
 * Returns all WhatsApp chats from the connected account
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsAppChatService } from '@/services/WhatsAppChatService';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const includeGroups = searchParams.get('includeGroups') === 'true';

        console.log('[API /whatsapp-chats] Fetching all chats...');

        const chats = await whatsAppChatService.getAllChats(includeGroups);

        return NextResponse.json({
            chats,
            total: chats.length
        });
    } catch (error: any) {
        console.error('[API /whatsapp-chats] Error:', error);

        // User-friendly error messages
        if (error.message?.includes('not connected')) {
            return NextResponse.json(
                { error: 'WhatsApp não está conectado. Conecte via QR code primeiro.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Erro ao buscar chats' },
            { status: 500 }
        );
    }
}
