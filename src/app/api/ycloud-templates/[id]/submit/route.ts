/**
 * YCloud Templates API - Submit for Approval
 * 
 * POST /api/ycloud-templates/[id]/submit - Submit template to YCloud
 */

import { NextResponse, NextRequest } from 'next/server';
import { yCloudTemplateService } from '@/services/YCloudTemplateService';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const templateId = parseInt(id);

        if (isNaN(templateId)) {
            return NextResponse.json(
                { error: 'Invalid template ID' },
                { status: 400 }
            );
        }

        const result = await yCloudTemplateService.submitForApproval(templateId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            ycloud_template_id: result.data
        });
    } catch (error) {
        console.error('Error submitting template:', error);
        return NextResponse.json(
            { error: 'Failed to submit template' },
            { status: 500 }
        );
    }
}
