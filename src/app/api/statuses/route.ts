/**
 * Status API Route - Configurable status management
 * 
 * GET /api/statuses - List all statuses
 * POST /api/statuses - Create a new status
 * PUT /api/statuses - Update a status
 * DELETE /api/statuses?id=X - Delete a status
 */

import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';

interface StatusRow {
    id: number;
    name: string;
    color: string;
    display_order: number;
    active: number;
    created_at: string;
    updated_at: string;
}

export async function GET() {
    try {
        const result = await pool.query(`
            SELECT * FROM statuses 
            WHERE active = 1 
            ORDER BY display_order ASC
        `);

        return NextResponse.json({
            data: result.rows as StatusRow[],
            total: result.rows.length
        });
    } catch (error) {
        console.error('[API /api/statuses GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch statuses' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, color } = body;

        if (!name || !name.trim()) {
            return NextResponse.json(
                { error: 'Nome é obrigatório' },
                { status: 400 }
            );
        }

        // Get max order
        const maxOrderResult = await pool.query(`
            SELECT COALESCE(MAX(display_order), 0) as max_order FROM statuses
        `);
        const maxOrder = maxOrderResult.rows[0].max_order;

        const result = await pool.query(`
            INSERT INTO statuses (name, color, display_order, active)
            VALUES ($1, $2, $3, 1)
            RETURNING id
        `, [name.trim(), color || '#6b7280', maxOrder + 1]);

        return NextResponse.json({
            success: true,
            id: result.rows[0].id
        });
    } catch (error: unknown) {
        console.error('[API /api/statuses POST] Error:', error);

        const isErr = error instanceof Error;
        if (isErr && (error.message?.includes('duplicate key') || (error as any).code === '23505')) {
            return NextResponse.json(
                { error: 'Status já existe' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create status' },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, color, display_order } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'ID é obrigatório' },
                { status: 400 }
            );
        }

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name.trim());
        }
        if (color) {
            updates.push(`color = $${paramIndex++}`);
            values.push(color);
        }
        if (display_order !== undefined) {
            updates.push(`display_order = $${paramIndex++}`);
            values.push(display_order);
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        await pool.query(`
            UPDATE statuses 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
        `, values);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API /api/statuses PUT] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update status' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'ID é obrigatório' },
                { status: 400 }
            );
        }

        // Soft delete - just mark as inactive
        await pool.query(`
            UPDATE statuses 
            SET active = 0, updated_at = NOW()
            WHERE id = $1
        `, [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API /api/statuses DELETE] Error:', error);
        return NextResponse.json(
            { error: 'Failed to delete status' },
            { status: 500 }
        );
    }
}
