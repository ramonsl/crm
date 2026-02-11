/**
 * Enrollments API Route
 *
 * GET /api/enrollments?semesterId=1 — Returns enrollment grid grouped by weekday
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnrollmentService } from '@/services/EnrollmentService';
import { semesterQuerySchema } from '@/types/enrollment';

const service = new EnrollmentService();

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const rawSemesterId = searchParams.get('semesterId');

        const validation = semesterQuerySchema.safeParse({ semesterId: rawSemesterId });
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Parâmetro semesterId inválido', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const grid = await service.getEnrollmentGrid(validation.data.semesterId);
        return NextResponse.json(grid);
    } catch (error) {
        console.error('[Enrollments API] GET error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
