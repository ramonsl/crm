/**
 * YCloud Templates API - List and Create
 * 
 * GET /api/ycloud-templates - List all templates
 * POST /api/ycloud-templates - Create a new template draft
 */

import { NextResponse, NextRequest } from 'next/server';
import { yCloudTemplateService } from '@/services/YCloudTemplateService';
import type { CreateYCloudTemplateDto } from '@/lib/repositories/YCloudTemplateRepository';

export async function GET() {
    try {
        const templates = await yCloudTemplateService.listTemplates();
        return NextResponse.json({ data: templates });
    } catch (error) {
        console.error('Error listing templates:', error);
        return NextResponse.json(
            { error: 'Failed to list templates' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as CreateYCloudTemplateDto;

        // Validate required fields
        if (!body.template_name || !body.friendly_name || !body.category || !body.body_text) {
            return NextResponse.json(
                { error: 'Missing required fields: template_name, friendly_name, category, body_text' },
                { status: 400 }
            );
        }

        const result = await yCloudTemplateService.createDraft(body);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ data: result.data }, { status: 201 });
    } catch (error) {
        console.error('Error creating template:', error);
        return NextResponse.json(
            { error: 'Failed to create template' },
            { status: 500 }
        );
    }
}
