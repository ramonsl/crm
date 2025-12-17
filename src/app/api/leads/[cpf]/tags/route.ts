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
    context: RouteParams
) {
    try {
        // Next.js 15: params is now a Promise
        const { cpf } = await context.params;

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
        console.error(`[API /api/leads/tags GET] Error:`, error);
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
    context: RouteParams
) {
    try {
        // Next.js 15: params is now a Promise
        const { cpf } = await context.params;
        console.log('[API POST /api/leads/:cpf/tags] Starting...', { cpf });

        const body = await req.json();
        const { tagId } = body;
        console.log('[API POST] Body parsed:', { cpf, tagId });

        if (!tagId) {
            console.log('[API POST] Missing tagId');
            return NextResponse.json(
                { error: 'tagId é obrigatório' },
                { status: 400 }
            );
        }

        // Note: CPF field can also contain phone number for leads without CPF
        // So we don't validate if it's a real CPF format

        // Check if tag exists and is active
        console.log('[API POST] Checking if tag exists:', tagId);
        const tagCheck = await pool.query(
            'SELECT id FROM tags WHERE id = $1 AND active = 1',
            [tagId]
        );
        console.log('[API POST] Tag check result:', tagCheck.rows.length);

        if (tagCheck.rows.length === 0) {
            console.log('[API POST] Tag not found or inactive');
            return NextResponse.json(
                { error: 'Tag não encontrada ou inativa' },
                { status: 404 }
            );
        }

        // Insert association
        console.log('[API POST] Inserting association...', { cpf, tagId });
        await pool.query(
            `INSERT INTO lead_tags (lead_cpf, tag_id) 
             VALUES ($1, $2)
             ON CONFLICT (lead_cpf, tag_id) DO NOTHING`,
            [cpf, tagId]
        );
        console.log('[API POST] Association inserted successfully');

        return NextResponse.json({ success: true }, { status: 201 });

    } catch (error) {
        console.error(`[API /api/leads/tags POST] Error:`, error);
        console.error('[API POST] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json(
            { error: 'Failed to associate tag' },
            { status: 500 }
        );
    }
}
