/**
 * API Route - Message History
 * GET /api/message-history?phone={phone}
 * GET /api/message-history?cpf={cpf} (backward compatibility)
 * 
 * Returns template send history for a contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { SQLiteTemplateHistoryRepository } from '@/repositories/templateHistoryRepository';
import { TemplateHistoryService } from '@/services/templateHistoryService';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const phone = searchParams.get('phone') || searchParams.get('cpf'); // Support both for backward compatibility

        if (!phone) {
            return NextResponse.json(
                { error: 'Phone number is required' },
                { status: 400 }
            );
        }

        console.log(`[API] Fetching message history for ${phone}`);

        // Dependency Injection - Clean Architecture
        const repository = new SQLiteTemplateHistoryRepository();
        const service = new TemplateHistoryService(repository);

        // Fetch history
        const history = await service.getPhoneHistory(phone);

        // Format for HistoryModal (compatible with existing interface)
        const messages = history.map(entry => ({
            id: entry.id,
            contact_cpf: phone, // Keep for backward compatibility
            phone: entry.phone,
            message: entry.template_content,
            template_name: entry.template_name,
            direction: 'sent' as const,
            timestamp: entry.sent_at,
            status: entry.success ? 'delivered' : 'failed'
        }));

        console.log(`[API] ✅ Returning ${messages.length} messages`);

        return NextResponse.json({
            messages,
            total: messages.length
        });

    } catch (error: any) {
        console.error('[API] Error fetching message history:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
