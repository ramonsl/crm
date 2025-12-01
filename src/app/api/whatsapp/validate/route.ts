import { NextResponse, NextRequest } from 'next/server';
import { validateWhatsAppNumber } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const phone = searchParams.get('phone');

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const chatId = await validateWhatsAppNumber(phone);

        return NextResponse.json({
            valid: !!chatId,
            chatId: chatId
        });
    } catch (error) {
        console.error('Error validating WhatsApp number:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
