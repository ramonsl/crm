/**
 * API Route - Template History Recording
 * POST /api/template-history
 * 
 * Records when a template is sent to a contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { SQLiteTemplateHistoryRepository } from '@/repositories/templateHistoryRepository';
import { TemplateHistoryService } from '@/services/templateHistoryService';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone, templateName, templateContent, success, errorMessage } = body;

        if (!phone || !templateName) {
            return NextResponse.json(
                { error: 'Phone and template name are required' },
                { status: 400 }
            );
        }

        console.log(`[API] Recording template: ${templateName} → ${phone}`);

        // Dependency Injection
        const repository = new SQLiteTemplateHistoryRepository();
        const service = new TemplateHistoryService(repository);

        // Record the template send event
        await service.recordTemplateSent({
            phone,
            templateName,
            templateContent: templateContent || '',
            success: success !== false, // Default to true
            errorMessage
        });

        console.log(`[API] ✅ Template history recorded`);

        return NextResponse.json({
            success: true,
            message: 'Template history recorded'
        });

    } catch (error: any) {
        console.error('[API] Error recording template history:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
