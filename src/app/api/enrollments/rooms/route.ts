/**
 * Enrollment Rooms API Route
 *
 * PATCH /api/enrollments/rooms — Update room assignment for an enrollment
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnrollmentService } from '@/services/EnrollmentService';
import { updateRoomSchema } from '@/types/enrollment';

const service = new EnrollmentService();

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = updateRoomSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        await service.updateRoom(validation.data.enrollmentId, validation.data.room);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Enrollments Rooms API] PATCH error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
