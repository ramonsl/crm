import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/AuthService';

const authService = new AuthService();

export async function GET(req: NextRequest) {
    try {
        // Get session ID from cookie
        const sessionId = req.cookies.get('session_id')?.value;

        if (!sessionId) {
            return NextResponse.json(
                { error: 'Não autenticado' },
                { status: 401 }
            );
        }

        // Validate session (async now)
        const result = await authService.validateSession(sessionId);

        if (!result.valid) {
            return NextResponse.json(
                { error: result.error || 'Sessão inválida' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            user: result.user
        });
    } catch (error) {
        console.error('[API /api/auth/session] Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
