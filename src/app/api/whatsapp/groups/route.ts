import { NextRequest, NextResponse } from 'next/server';
import { listAllGroups, isNumberInGroup, getGroupParticipants } from '@/lib/whatsapp';

/**
 * GET /api/whatsapp/groups
 * Lista todos os grupos do WhatsApp ou verifica se um número está em um grupo
 * 
 * Query params:
 * - action: 'list' | 'check' | 'participants'
 * - phone: (opcional) número de telefone para verificar
 * - groupId: (opcional) ID ou nome do grupo
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action') || 'list';
        const phone = searchParams.get('phone');
        const groupId = searchParams.get('groupId');

        switch (action) {
            case 'list': {
                // Listar todos os grupos
                const groups = await listAllGroups();
                return NextResponse.json({
                    success: true,
                    groups,
                    total: groups.length
                });
            }

            case 'check': {
                // Verificar se um número está em um grupo
                if (!phone || !groupId) {
                    return NextResponse.json({
                        success: false,
                        error: 'Phone and groupId are required for check action'
                    }, { status: 400 });
                }

                const isInGroup = await isNumberInGroup(phone, groupId);
                return NextResponse.json({
                    success: true,
                    phone,
                    groupId,
                    isInGroup
                });
            }

            case 'participants': {
                // Listar participantes de um grupo
                if (!groupId) {
                    return NextResponse.json({
                        success: false,
                        error: 'groupId is required for participants action'
                    }, { status: 400 });
                }

                const participants = await getGroupParticipants(groupId);
                return NextResponse.json({
                    success: true,
                    groupId,
                    participants,
                    total: participants.length
                });
            }

            default:
                return NextResponse.json({
                    success: false,
                    error: `Unknown action: ${action}. Use 'list', 'check', or 'participants'`
                }, { status: 400 });
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/whatsapp/groups:', errorMessage);

        return NextResponse.json({
            success: false,
            error: errorMessage
        }, { status: 500 });
    }
}
