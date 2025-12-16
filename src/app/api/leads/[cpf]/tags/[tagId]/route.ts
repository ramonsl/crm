/**
 * Delete Lead Tag API Route
 * 
 * DELETE /api/leads/[cpf]/tags/[tagId] - Remove tag association from lead
 */

import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';

interface RouteParams {
    params: {
        cpf: string;
        tagId: string;
    };
}

/**
 * DELETE /api/leads/[cpf]/tags/[tagId]
 * Removes a tag association from a lead
 */
export async function DELETE(
    req: NextRequest,
    { params }: RouteParams
) {
    try {
        const { cpf, tagId } = params;

        // Delete the association
        const result = await pool.query(
            `DELETE FROM lead_tags 
             WHERE lead_cpf = $1 AND tag_id = $2`,
            [cpf, tagId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json(
                { error: 'Associação não encontrada' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(`[API /api/leads/${params.cpf}/tags/${params.tagId} DELETE] Error:`, error);
        return NextResponse.json(
            { error: 'Failed to remove tag association' },
            { status: 500 }
        );
    }
}
