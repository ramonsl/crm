import { getErrorMessage } from '@/lib/types';

import { NextRequest, NextResponse } from 'next/server';
import { getClient, getStatus } from '@/lib/whatsapp';

// GET /api/whatsapp/fetch-messages?phone=51981636027&limit=20&offset=0
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const phone = searchParams.get('phone');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const status = getStatus();
        if (status.status !== 'ready') {
            return NextResponse.json({
                error: 'WhatsApp não está conectado',
                status: status.status
            }, { status: 400 });
        }

        const client = getClient();
        if (!client) {
            return NextResponse.json({
                error: 'Cliente WhatsApp não disponível'
            }, { status: 400 });
        }

        // Format phone number
        let formattedPhone = phone.replace(/\D/g, '');

        if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
        }

        if (formattedPhone.length === 10 || formattedPhone.length === 11) {
            formattedPhone = '55' + formattedPhone;
        }

        // Try variations for Brazilian numbers
        const variations: string[] = [formattedPhone];

        if (formattedPhone.startsWith('55') && formattedPhone.length === 13) {
            const without9 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
            variations.push(without9);
        } else if (formattedPhone.startsWith('55') && formattedPhone.length === 12) {
            const with9 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
            variations.push(with9);
        }

        console.log(`[Fetch Messages] Trying variations: ${variations.join(', ')}`);

        let chat = null;
        let usedVariation = '';

        // Try each variation
        for (const phoneVariation of variations) {
            try {
                const chatId = `${phoneVariation}@c.us`;
                console.log(`[Fetch Messages] Trying chatId: ${chatId}`);

                chat = await client.getChatById(chatId);

                if (chat) {
                    usedVariation = phoneVariation;
                    console.log(`[Fetch Messages] Found chat with ${phoneVariation}`);
                    break;
                }
            } catch (err) {
                console.log(`[Fetch Messages] No chat with variation ${phoneVariation}`);
            }
        }

        if (!chat) {
            return NextResponse.json({
                error: 'Conversa não encontrada no WhatsApp',
                messages: [],
                hasMore: false
            }, { status: 404 });
        }

        // Fetch messages with pagination
        // WhatsApp returns newest first, so we need to handle offset
        const totalToFetch = offset + limit;
        console.log(`[Fetch Messages] Fetching ${totalToFetch} messages (offset: ${offset}, limit: ${limit})`);

        const allMessages = await chat.fetchMessages({ limit: totalToFetch });

        // Slice to get only the requested page
        const pageMessages = allMessages.slice(offset, offset + limit);

        console.log(`[Fetch Messages] Fetched ${allMessages.length} total, returning ${pageMessages.length} messages`);

        // Transform messages to our format
        const messages = pageMessages.map((msg: any) => ({
            id: msg.id.id,
            direction: msg.fromMe ? 'outgoing' : 'incoming',
            body: msg.body,
            timestamp: new Date(msg.timestamp * 1000).toISOString(),
            status: msg.ack ? 'sent' : 'pending',
            media_url: null
        }));

        // Reverse to show oldest first (chronological order)
        messages.reverse();

        return NextResponse.json({
            messages,
            hasMore: allMessages.length >= totalToFetch,
            total: allMessages.length
        });

    } catch (error: unknown) {
        console.error('[Fetch Messages] Error:', error);
        return NextResponse.json({
            error: 'Erro ao buscar mensagens',
            message: getErrorMessage(error)
        }, { status: 500 });
    }
}
