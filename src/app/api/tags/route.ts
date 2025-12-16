/**
 * Tags API Route
 * 
 * RESTful endpoints for tag management.
 * Follows single responsibility and clean code principles.
 * 
 * GET /api/tags - List all active tags with usage count
 * POST /api/tags - Create new tag
 * PUT /api/tags - Update existing tag
 * DELETE /api/tags?id=X - Soft delete tag
 */

import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import type { Tag, CreateTagDTO, UpdateTagDTO, TagWithUsage } from '@/types/tag';

/**
 * GET /api/tags
 * Lists all active tags with usage count
 */
export async function GET() {
    try {
        const result = await pool.query(`
            SELECT 
                t.*,
                COUNT(lt.id) as usage_count
            FROM tags t
            LEFT JOIN lead_tags lt ON t.id = lt.tag_id
            WHERE t.active = 1
            GROUP BY t.id
            ORDER BY t.name ASC
        `);

        return NextResponse.json({
            data: result.rows as TagWithUsage[],
            total: result.rows.length
        });
    } catch (error) {
        console.error('[API /api/tags GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tags' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/tags
 * Creates a new tag
 */
export async function POST(req: NextRequest) {
    try {
        const body: CreateTagDTO = await req.json();
        const { name, color, description } = body;

        // Validation
        if (!name || !name.trim()) {
            return NextResponse.json(
                { error: 'Nome é obrigatório' },
                { status: 400 }
            );
        }

        if (name.length > 50) {
            return NextResponse.json(
                { error: 'Nome deve ter no máximo 50 caracteres' },
                { status: 400 }
            );
        }

        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return NextResponse.json(
                { error: 'Cor deve estar no formato #RRGGBB' },
                { status: 400 }
            );
        }

        // Insert tag
        const result = await pool.query(
            `INSERT INTO tags (name, color, description) 
             VALUES ($1, $2, $3) 
             RETURNING id`,
            [name.trim(), color || '#6b7280', description || null]
        );

        return NextResponse.json({
            success: true,
            id: result.rows[0].id
        }, { status: 201 });

    } catch (error: any) {
        console.error('[API /api/tags POST] Error:', error);

        // Handle unique constraint violation
        if (error.message?.includes('duplicate key') || error.code === '23505') {
            return NextResponse.json(
                { error: 'Tag com este nome já existe' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create tag' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/tags
 * Updates an existing tag
 */
export async function PUT(req: NextRequest) {
    try {
        const body: UpdateTagDTO = await req.json();
        const { id, name, color, description } = body;

        // Validation
        if (!id) {
            return NextResponse.json(
                { error: 'ID é obrigatório' },
                { status: 400 }
            );
        }

        if (name && name.length > 50) {
            return NextResponse.json(
                { error: 'Nome deve ter no máximo 50 caracteres' },
                { status: 400 }
            );
        }

        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return NextResponse.json(
                { error: 'Cor deve estar no formato #RRGGBB' },
                { status: 400 }
            );
        }

        // Build update query dynamically
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
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'Nenhum campo para atualizar' },
                { status: 400 }
            );
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        await pool.query(
            `UPDATE tags SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[API /api/tags PUT] Error:', error);

        if (error.code === '23505') {
            return NextResponse.json(
                { error: 'Tag com este nome já existe' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to update tag' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/tags?id=X
 * Soft deletes a tag (sets active = 0)
 */
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
        await pool.query(
            `UPDATE tags SET active = 0, updated_at = NOW() WHERE id = $1`,
            [id]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API /api/tags DELETE] Error:', error);
        return NextResponse.json(
            { error: 'Failed to delete tag' },
            { status: 500 }
        );
    }
}
