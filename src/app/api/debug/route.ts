import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Read recent console logs if available
        return NextResponse.json({
            message: 'Debug endpoint active',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}
