/**
 * Activities API Route - Timeline feature
 * 
 * GET /api/activities?cpf=XXX&limit=50 - List activities for a contact
 * POST /api/activities - Create a manual note activity
 */

import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { ActivityRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';
import { getErrorMessage } from '@/lib/types';

// Initialize repository and service
const activityRepository = new ActivityRepository(db);
const activityService = new ActivityService(activityRepository);

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');
        const limit = parseInt(searchParams.get('limit') || '100');
        const includeMessages = searchParams.get('includeMessages') !== 'false'; // default true

        if (!cpf) {
            return NextResponse.json(
                { error: 'CPF é obrigatório' },
                { status: 400 }
            );
        }

        // Fetch activities from activities table
        const activities = activityRepository.findByContact(cpf, limit);

        // Fetch messages from messages table (if requested)
        let messages: any[] = [];
        if (includeMessages) {
            // First, get the lead's phone number to find messages
            const leadStmt = db.prepare('SELECT telefone FROM leads WHERE cpf = ?');
            const lead = leadStmt.get(cpf) as { telefone: string } | undefined;

            // Build list of possible identifiers for messages lookup
            const identifiers: string[] = [cpf];

            if (lead?.telefone) {
                const phone = lead.telefone.replace(/\D/g, '');

                // Add phone variations
                identifiers.push(phone);
                identifiers.push(`55${phone}`); // With country code

                // Handle 9th digit variations for Brazilian mobile
                if (phone.length === 11 && phone[2] === '9') {
                    // Has 9th digit, add version without
                    identifiers.push(phone.substring(0, 2) + phone.substring(3));
                    identifiers.push(`55${phone.substring(0, 2)}${phone.substring(3)}`);
                } else if (phone.length === 10) {
                    // No 9th digit, add version with
                    identifiers.push(phone.substring(0, 2) + '9' + phone.substring(2));
                    identifiers.push(`55${phone.substring(0, 2)}9${phone.substring(2)}`);
                }
            }

            // Query messages with all possible identifiers
            const placeholders = identifiers.map(() => '?').join(',');
            const messagesStmt = db.prepare(`
                SELECT id, contact_cpf, direction, body, timestamp, media_type
                FROM messages 
                WHERE contact_cpf IN (${placeholders})
                ORDER BY timestamp DESC 
                LIMIT ?
            `);
            messages = messagesStmt.all(...identifiers, limit) as any[];

            console.log(`[Activities API] Found ${messages.length} messages for identifiers:`, identifiers);
        }

        // Convert messages to activity-like format
        const messageActivities = messages.map(msg => ({
            id: `msg_${msg.id}`,
            contact_cpf: msg.contact_cpf,
            type: 'whatsapp' as const,
            subtype: msg.direction === 'outgoing' ? 'sent' : 'received',
            title: msg.direction === 'outgoing' ? 'WhatsApp enviado' : 'WhatsApp recebido',
            description: msg.body || (msg.media_type ? `[${msg.media_type}]` : null),
            metadata: null,
            created_at: msg.timestamp,
            source: 'messages' as const,
        }));

        // Merge and sort by date (most recent first)
        const allActivities = [...activities, ...messageActivities].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        });

        // Apply limit after merge
        const limitedActivities = allActivities.slice(0, limit);

        return NextResponse.json({
            data: limitedActivities,
            total: allActivities.length,
            cpf,
        });
    } catch (error: unknown) {
        console.error('[API /api/activities GET] Error:', error);
        return NextResponse.json(
            { error: getErrorMessage(error) },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cpf, note } = body;

        if (!cpf) {
            return NextResponse.json(
                { error: 'CPF é obrigatório' },
                { status: 400 }
            );
        }

        if (!note || note.trim() === '') {
            return NextResponse.json(
                { error: 'Nota é obrigatória' },
                { status: 400 }
            );
        }

        // Use service to create note activity
        const activity = activityService.logNote(cpf, note.trim());

        return NextResponse.json({
            success: true,
            data: activity,
        });
    } catch (error: unknown) {
        console.error('[API /api/activities POST] Error:', error);
        return NextResponse.json(
            { error: getErrorMessage(error) },
            { status: 500 }
        );
    }
}
