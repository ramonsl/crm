/**
 * Semesters API Route
 *
 * GET  /api/semesters — List all semesters
 * POST /api/semesters — Create a new semester
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnrollmentService } from '@/services/EnrollmentService';
import { createSemesterSchema } from '@/types/enrollment';

const service = new EnrollmentService();

export async function GET() {
    try {
        const semesters = await service.getSemesters();
        return NextResponse.json(semesters);
    } catch (error) {
        console.error('[Semesters API] GET error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = createSemesterSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const semester = await service.createSemester(validation.data.code);
        return NextResponse.json(semester, { status: 201 });
    } catch (error: unknown) {
        // Handle unique constraint violation
        if (error instanceof Error && error.message.includes('unique')) {
            return NextResponse.json(
                { error: 'Semestre já existe' },
                { status: 409 }
            );
        }
        console.error('[Semesters API] POST error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
