import { handleApiError } from '@/lib/api/handleApiError';
import { AppError } from '@/lib/errors/AppError';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// Mock NextResponse.json to inspect call arguments
jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((body, init) => ({ body, init })),
    },
}));

describe('handleApiError', () => {
    it('should return the correct status and message for AppError', () => {
        const error = new AppError('Custom error message', 404);
        const response = handleApiError(error) as any;

        expect(response.body).toEqual({ error: 'Custom error message' });
        expect(response.init.status).toBe(404);
    });

    it('should default to status 400 for AppError if not specified', () => {
        const error = new AppError('Bad request');
        const response = handleApiError(error) as any;

        expect(response.body).toEqual({ error: 'Bad request' });
        expect(response.init.status).toBe(400);
    });

    it('should return status 400 and validation details for ZodError', () => {
        const zodError = new ZodError([
            {
                code: 'invalid_type',
                expected: 'string',
                path: ['name'],
                message: 'Expected string, received number',
            } as any, // Cast to any to bypass strict literal checks for test
        ]);
        const response = handleApiError(zodError) as any;

        expect(response.body).toEqual({
            error: 'Erro de validação',
            details: zodError.flatten().fieldErrors,
        });
        expect(response.init.status).toBe(400);
    });

    it('should return status 500 for generic Error', () => {
        const error = new Error('Unexpected failure');
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { }); // Silence console.error
        const response = handleApiError(error) as any;

        expect(response.body).toEqual({ error: 'Internal Server Error' });
        expect(response.init.status).toBe(500);
        expect(spy).toHaveBeenCalledWith('Internal Server Error:', error);

        spy.mockRestore();
    });

    it('should return status 500 for unknown error types', () => {
        const error = 'Something went wrong string';
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const response = handleApiError(error) as any;

        expect(response.body).toEqual({ error: 'Internal Server Error' });
        expect(response.init.status).toBe(500);

        spy.mockRestore();
    });
});
