/**
 * YCloud Templates API - Sync Status
 * 
 * POST /api/ycloud-templates/sync - Sync template statuses from YCloud
 */

import { NextResponse } from 'next/server';
import { yCloudTemplateService } from '@/services/YCloudTemplateService';

export async function POST() {
    try {
        console.log('[YCloud Sync] Starting template sync...');
        const result = await yCloudTemplateService.syncAllFromYCloud();

        console.log('[YCloud Sync] Result:', result);

        if (!result.success) {
            console.error('[YCloud Sync] Sync failed:', result.error);
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        console.log('[YCloud Sync] Success:', result.data);
        return NextResponse.json({
            success: true,
            imported: result.data?.imported || 0,
            updated: result.data?.updated || 0,
            errors: result.data?.errors || 0
        });
    } catch (error) {
        console.error('[YCloud Sync] Unexpected error:', error);
        console.error('[YCloud Sync] Stack:', error instanceof Error ? error.stack : 'No stack trace');
        return NextResponse.json(
            {
                error: 'Failed to sync templates',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
