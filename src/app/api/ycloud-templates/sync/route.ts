/**
 * YCloud Templates API - Sync Status
 * 
 * POST /api/ycloud-templates/sync - Sync template statuses from YCloud
 */

import { NextResponse } from 'next/server';
import { yCloudTemplateService } from '@/services/YCloudTemplateService';

export async function POST() {
    try {
        const result = await yCloudTemplateService.syncStatuses();

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            updated: result.data?.updated || 0,
            errors: result.data?.errors || 0
        });
    } catch (error) {
        console.error('Error syncing templates:', error);
        return NextResponse.json(
            { error: 'Failed to sync templates' },
            { status: 500 }
        );
    }
}
