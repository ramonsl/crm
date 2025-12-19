/**
 * API: /api/status-templates
 * 
 * CRUD for managing status → template associations.
 * Allows configuring which template to send when a lead changes to a specific status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { statusTemplateRepository } from '@/lib/repositories/StatusTemplateRepository';

/**
 * GET /api/status-templates
 * List all status-template associations
 */
export async function GET() {
    try {
        const associations = await statusTemplateRepository.findAllWithTemplates();
        return NextResponse.json({ data: associations });
    } catch (error) {
        console.error('[API /api/status-templates GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch status templates' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/status-templates
 * Create or update a status-template association
 * Body: { status_name: string, template_id: number | null, is_active?: boolean }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { status_name, template_id, is_active = true } = body;

        if (!status_name) {
            return NextResponse.json(
                { error: 'status_name is required' },
                { status: 400 }
            );
        }

        await statusTemplateRepository.upsert(
            status_name,
            template_id || null,
            is_active
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API /api/status-templates POST] Error:', error);
        return NextResponse.json(
            { error: 'Failed to save status template' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/status-templates?status_name=xxx
 * Remove a status-template association
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const statusName = searchParams.get('status_name');

        if (!statusName) {
            return NextResponse.json(
                { error: 'status_name is required' },
                { status: 400 }
            );
        }

        await statusTemplateRepository.delete(statusName);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API /api/status-templates DELETE] Error:', error);
        return NextResponse.json(
            { error: 'Failed to delete status template' },
            { status: 500 }
        );
    }
}
