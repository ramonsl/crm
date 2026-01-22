import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from '@/lib/errors/AppError';

export function handleApiError(error: unknown) {
    if (error instanceof AppError) {
        return NextResponse.json(
            { error: error.message },
            { status: error.statusCode }
        );
    }

    if (error instanceof ZodError) {
        return NextResponse.json(
            {
                error: 'Erro de validação',
                details: error.flatten().fieldErrors
            },
            { status: 400 }
        );
    }

    console.error('Internal Server Error:', error);

    return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
    );
}
