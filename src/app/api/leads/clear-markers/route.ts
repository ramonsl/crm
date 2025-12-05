import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST() {
    try {
        const stmt = db.prepare(`
            UPDATE leads 
            SET is_new = 0, status_changed = 0 
            WHERE is_new = 1 OR status_changed = 1
        `);

        const result = stmt.run();

        return NextResponse.json({
            success: true,
            cleared: result.changes,
            message: `${result.changes} marcações foram limpas com sucesso.`
        });
    } catch (error) {
        console.error('Error clearing markers:', error);
        return NextResponse.json(
            { error: 'Failed to clear markers' },
            { status: 500 }
        );
    }
}
