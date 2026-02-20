/**
 * Enrollment Import API Route
 *
 * POST /api/enrollments/import — Upload XLS file and import enrollment data
 * Expects multipart/form-data with fields: file (XLS), semesterId (number)
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnrollmentService } from '@/services/EnrollmentService';
import { z } from 'zod';

const service = new EnrollmentService();

const importSchema = z.object({
    semesterId: z.coerce.number().int().positive('semesterId deve ser um número positivo'),
});

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const rawSemesterId = formData.get('semesterId');

        // Validate file
        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { error: 'Arquivo XLS é obrigatório' },
                { status: 400 }
            );
        }

        // Validate file extension
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
            return NextResponse.json(
                { error: 'Formato de arquivo inválido. Envie um arquivo .xls ou .xlsx' },
                { status: 400 }
            );
        }

        // Validate semesterId
        const validation = importSchema.safeParse({ semesterId: rawSemesterId });
        if (!validation.success) {
            return NextResponse.json(
                { error: 'semesterId inválido', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        // Read file as buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const result = await service.importEnrollments(validation.data.semesterId, buffer);

        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error('[Enrollments Import API] POST error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
