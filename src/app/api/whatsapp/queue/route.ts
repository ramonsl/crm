import { NextResponse, NextRequest } from 'next/server';
import { messageQueue } from '@/lib/messageQueue';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
        }

        messageQueue.enqueue(messages);

        console.log('[Queue API] Enqueued messages:', JSON.stringify(messages, null, 2));

        return NextResponse.json({ success: true, message: `Enqueued ${messages.length} messages` });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const state = messageQueue.getState();
        return NextResponse.json(state);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        messageQueue.clear();
        return NextResponse.json({ success: true, message: 'Queue cleared' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
