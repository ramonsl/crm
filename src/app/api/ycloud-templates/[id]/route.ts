/**
 * YCloud Templates API - CRUD by ID
 * 
 * GET /api/ycloud-templates/[id] - Get a template
 * PUT /api/ycloud-templates/[id] - Update a template
 * DELETE /api/ycloud-templates/[id] - Delete a template
 */

import { NextResponse, NextRequest } from 'next/server';
import { yCloudTemplateService } from '@/services/YCloudTemplateService';
import type { UpdateYCloudTemplateDto } from '@/lib/repositories/YCloudTemplateRepository';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const templateId = parseInt(id);

        if (isNaN(templateId)) {
            return NextResponse.json(
                { error: 'Invalid template ID' },
                { status: 400 }
            );
        }

        const template = await yCloudTemplateService.getTemplate(templateId);

        if (!template) {
            return NextResponse.json(
                { error: 'Template not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: template });
    } catch (error) {
        console.error('Error getting template:', error);
        return NextResponse.json(
            { error: 'Failed to get template' },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const templateId = parseInt(id);

        if (isNaN(templateId)) {
            return NextResponse.json(
                { error: 'Invalid template ID' },
                { status: 400 }
            );
        }

        const body = await req.json() as UpdateYCloudTemplateDto;
        const result = await yCloudTemplateService.updateDraft(templateId, body);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating template:', error);
        return NextResponse.json(
            { error: 'Failed to update template' },
            { status: 500 }
        );
    }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const templateId = parseInt(id);

        if (isNaN(templateId)) {
            return NextResponse.json(
                { error: 'Invalid template ID' },
                { status: 400 }
            );
        }

        const result = await yCloudTemplateService.deleteTemplate(templateId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting template:', error);
        return NextResponse.json(
            { error: 'Failed to delete template' },
            { status: 500 }
        );
    }
}
