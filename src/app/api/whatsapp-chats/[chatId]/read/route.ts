/**
 * POST /api/whatsapp-chats/[chatId]/read
 * 
 * Marks a chat as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsAppChatService } from '@/services/WhatsAppChatService';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const { chatId } = await params;

        console.log(`[API /whatsapp-chats/${chatId}/read] Marking as read...`);

        await whatsAppChatService.markAsRead(chatId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API /whatsapp-chats/read] Error:', error);

        return NextResponse.json(
            { error: error.message || 'Erro ao marcar como lido' },
            { status: 500 }
        );
    }
}
