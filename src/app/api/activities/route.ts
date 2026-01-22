/**
 * Activities API Route - Timeline feature
 * 
 * GET /api/activities?cpf=XXX&limit=50 - List activities for a contact
 * POST /api/activities - Create a manual note activity
 */

import { NextResponse, NextRequest } from 'next/server';
import { ActivityRepository, LeadRepository, WhatsAppRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';
import { getErrorMessage } from '@/lib/types';
import type { ChatMessage } from '@/services/WhatsAppChatService';

// Initialize repository and service
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');
        const limit = parseInt(searchParams.get('limit') || '100');
        const includeMessages = searchParams.get('includeMessages') !== 'false';

        if (!cpf) {
            return NextResponse.json(
                { error: 'CPF é obrigatório' },
                { status: 400 }
            );
        }

        // Fetch activities from activities table
        const activities = await activityRepository.findByContact(cpf, limit);

        // Fetch messages from messages table (if requested)
        const messageActivities: any[] = [];

        if (includeMessages) {
            const leadRepository = new LeadRepository();
            const whatsAppRepository = new WhatsAppRepository();

            const lead = await leadRepository.findByCpf(cpf);

            // Build list of possible identifiers for messages lookup
            const identifiers: string[] = [cpf];

            if (lead?.telefone) {
                const phone = lead.telefone.replace(/\D/g, '');

                // Add phone variations
                identifiers.push(phone);
                identifiers.push(`55${phone}`);

                // Handle 9th digit variations for Brazilian mobile
                if (phone.length === 11 && phone[2] === '9') {
                    identifiers.push(phone.substring(0, 2) + phone.substring(3));
                    identifiers.push(`55${phone.substring(0, 2)}${phone.substring(3)}`);
                } else if (phone.length === 10) {
                    identifiers.push(phone.substring(0, 2) + '9' + phone.substring(2));
                    identifiers.push(`55${phone.substring(0, 2)}9${phone.substring(2)}`);
                }
            }

            // Query messages with all possible identifiers
            const chatMessages = await whatsAppRepository.findMessagesByPhones(identifiers, limit);

            // Map ChatMessage DTO to Activity format
            chatMessages.forEach((msg: ChatMessage) => {
                messageActivities.push({
                    id: `msg_${msg.id}`,
                    contact_cpf: cpf,
                    type: 'whatsapp' as const,
                    subtype: msg.fromMe ? 'sent' : 'received',
                    title: msg.fromMe ? 'WhatsApp enviado' : 'WhatsApp recebido',
                    description: msg.body || (msg.mediaType ? `[${msg.mediaType}]` : null),
                    metadata: null,
                    created_at: new Date(msg.timestamp * 1000).toISOString(),
                    source: 'messages' as const,
                });
            });
        }

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
        const activity = await activityService.logNote(cpf, note.trim());

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
