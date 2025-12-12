import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/AuthService';

const authService = new AuthService();

export async function POST(req: NextRequest) {
    try {
        // Get session ID from cookie
        const sessionId = req.cookies.get('session_id')?.value;

        if (sessionId) {
            // Invalidate session
            authService.logout(sessionId);
        }

        // Create response
        const response = NextResponse.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });

        // Clear session cookie
        response.cookies.delete('session_id');

        return response;
    } catch (error) {
        console.error('[API /api/auth/logout] Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
