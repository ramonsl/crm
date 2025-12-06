/**
 * Status API Route - Configurable status management
 * 
 * GET /api/statuses - List all statuses
 * POST /api/statuses - Create a new status
 * PUT /api/statuses - Update a status
 * DELETE /api/statuses?id=X - Delete a status
 */

import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';

// Ensure migration runs
import '@/lib/migrations/addStatusTable';

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
        const statuses = db.prepare(`
            SELECT * FROM statuses 
            WHERE active = 1 
            ORDER BY display_order ASC
        `).all() as StatusRow[];

        return NextResponse.json({
            data: statuses,
            total: statuses.length
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
        const maxOrder = db.prepare(`
            SELECT COALESCE(MAX(display_order), 0) as max_order FROM statuses
        `).get() as { max_order: number };

        const stmt = db.prepare(`
            INSERT INTO statuses (name, color, display_order, active)
            VALUES (?, ?, ?, 1)
        `);

        const result = stmt.run(name.trim(), color || '#6b7280', maxOrder.max_order + 1);

        return NextResponse.json({
            success: true,
            id: result.lastInsertRowid
        });
    } catch (error: any) {
        console.error('[API /api/statuses POST] Error:', error);

        if (error.message?.includes('UNIQUE constraint failed')) {
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

        if (name) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (color) {
            updates.push('color = ?');
            values.push(color);
        }
        if (display_order !== undefined) {
            updates.push('display_order = ?');
            values.push(display_order);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const stmt = db.prepare(`
            UPDATE statuses 
            SET ${updates.join(', ')}
            WHERE id = ?
        `);

        stmt.run(...values);

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
        const stmt = db.prepare(`
            UPDATE statuses 
            SET active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API /api/statuses DELETE] Error:', error);
        return NextResponse.json(
            { error: 'Failed to delete status' },
            { status: 500 }
        );
    }
}
