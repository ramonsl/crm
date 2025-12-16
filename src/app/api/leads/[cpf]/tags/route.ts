/**
 * Lead Tags API Route
 * 
 * Manages tag associations for a specific lead.
 * 
 * GET /api/leads/[cpf]/tags - List all tags for a lead
 * POST /api/leads/[cpf]/tags - Associate a tag to a lead
 * DELETE /api/leads/[cpf]/tags/[tagId] - Remove tag from lead
 */

import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import type { Tag } from '@/types/tag';

interface RouteParams {
    params: {
        cpf: string;
    };
}

/**
 * GET /api/leads/[cpf]/tags
 * Lists all tags associated with a lead
 */
export async function GET(
    req: NextRequest,
    { params }: RouteParams
) {
    try {
        const { cpf } = params;

        const result = await pool.query(`
            SELECT t.*
            FROM tags t
            INNER JOIN lead_tags lt ON t.id = lt.tag_id
            WHERE lt.lead_cpf = $1 AND t.active = 1
            ORDER BY t.name ASC
        `, [cpf]);

        return NextResponse.json({
            data: result.rows as Tag[]
        });
    } catch (error) {
        console.error(`[API /api/leads/${params.cpf}/tags GET] Error:`, error);
        return NextResponse.json(
            { error: 'Failed to fetch lead tags' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/leads/[cpf]/tags
 * Associates a tag to a lead
 */
export async function POST(
    req: NextRequest,
    { params }: RouteParams
) {
    try {
        const { cpf } = params;
        const body = await req.json();
        const { tagId } = body;

        if (!tagId) {
            return NextResponse.json(
                { error: 'tagId é obrigatório' },
                { status: 400 }
            );
        }

        // Check if lead exists
        const leadCheck = await pool.query(
            'SELECT cpf FROM leads WHERE cpf = $1',
            [cpf]
        );

        if (leadCheck.rows.length === 0) {
            return NextResponse.json(
                { error: 'Lead não encontrado' },
                { status: 404 }
            );
        }

        // Check if tag exists and is active
        const tagCheck = await pool.query(
            'SELECT id FROM tags WHERE id = $1 AND active = 1',
            [tagId]
        );

        if (tagCheck.rows.length === 0) {
            return NextResponse.json(
                { error: 'Tag não encontrada ou inativa' },
                { status: 404 }
            );
        }

        // Insert association
        await pool.query(
            `INSERT INTO lead_tags (lead_cpf, tag_id) 
             VALUES ($1, $2)
             ON CONFLICT (lead_cpf, tag_id) DO NOTHING`,
            [cpf, tagId]
        );

        return NextResponse.json({ success: true }, { status: 201 });

    } catch (error) {
        console.error(`[API /api/leads/${params.cpf}/tags POST] Error:`, error);
        return NextResponse.json(
            { error: 'Failed to associate tag' },
            { status: 500 }
        );
    }
}
