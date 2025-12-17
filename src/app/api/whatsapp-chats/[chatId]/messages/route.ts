import { getErrorMessage } from '@/lib/types';

/**
 * GET /api/whatsapp-chats/[chatId]/messages
 * 
 * Returns messages from a specific WhatsApp chat
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsAppChatService } from '@/services/WhatsAppChatService';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const { chatId } = await params;

        console.log(`[API /whatsapp-chats/${chatId}/messages] Fetching ${limit} messages...`);

        const messages = await whatsAppChatService.getChatMessages(chatId, limit);

        return NextResponse.json({
            messages,
            total: messages.length,
            hasMore: messages.length >= limit
        });
    } catch (error: unknown) {
        console.error('[API /whatsapp-chats/messages] Error:', error);

        const isErr = error instanceof Error;
        if (isErr && error.message?.includes('not connected')) {
            return NextResponse.json(
                { error: 'WhatsApp não está conectado' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: getErrorMessage(error) || 'Erro ao buscar mensagens' },
            { status: 500 }
        );
    }
}
