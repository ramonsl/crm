/**
 * YCloud Templates API - Test Connection
 * 
 * GET /api/ycloud-templates/test - Test YCloud API connection
 */

import { NextResponse } from 'next/server';
import { SettingRepository } from '@/lib/repositories/SettingRepository';

export async function GET() {
    try {
        const settingRepo = new SettingRepository();

        // Get credentials
        const apiKey = await settingRepo.get('ycloud_api_key');
        const wabaId = await settingRepo.get('ycloud_waba_id');
        const phoneId = await settingRepo.get('ycloud_phone_id');

        console.log('[YCloud Test] Credentials check:');
        console.log('  - API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
        console.log('  - WABA ID:', wabaId || 'NOT SET');
        console.log('  - Phone ID:', phoneId || 'NOT SET');

        if (!apiKey) {
            return NextResponse.json(
                { error: 'YCloud API key not configured' },
                { status: 400 }
            );
        }

        if (!wabaId) {
            return NextResponse.json(
                { error: 'YCloud WABA ID not configured' },
                { status: 400 }
            );
        }

        // Test API connection
        const url = `https://api.ycloud.com/v2/whatsapp/templates?wabaId=${wabaId}&limit=1`;
        console.log('[YCloud Test] Testing URL:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            }
        });

        console.log('[YCloud Test] Response status:', response.status);
        console.log('[YCloud Test] Response headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.json();
        console.log('[YCloud Test] Response data:', JSON.stringify(data, null, 2));

        if (!response.ok) {
            return NextResponse.json(
                {
                    error: 'YCloud API error',
                    status: response.status,
                    details: data
                },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Connection successful',
            templatesFound: data.total || 0,
            response: data
        });
    } catch (error) {
        console.error('[YCloud Test] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to test connection',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
