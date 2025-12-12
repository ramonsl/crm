import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST() {
    try {
        const result = await pool.query(`
            UPDATE leads 
            SET is_new = 0, status_changed = 0 
            WHERE is_new = 1 OR status_changed = 1
        `);

        return NextResponse.json({
            success: true,
            cleared: result.rowCount || 0,
            message: `${result.rowCount || 0} marcações foram limpas com sucesso.`
        });
    } catch (error) {
        console.error('Error clearing markers:', error);
        return NextResponse.json(
            { error: 'Failed to clear markers' },
            { status: 500 }
        );
    }
}
