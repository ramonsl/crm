import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/AuthService';
import { AppError } from '@/lib/errors/AppError';
import { handleApiError } from '@/lib/api/handleApiError';

const authService = new AuthService();

export async function GET(req: NextRequest) {
    try {
        // Get session ID from cookie
        const sessionId = req.cookies.get('session_id')?.value;

        if (!sessionId) {
            throw new AppError('Não autenticado', 401);
        }

        // Validate session (async now)
        const result = await authService.validateSession(sessionId);

        if (!result.valid) {
            throw new AppError(result.error || 'Sessão inválida', 401);
        }

        return NextResponse.json({
            success: true,
            user: result.user
        });
    } catch (error) {
        return handleApiError(error);
    }
}
