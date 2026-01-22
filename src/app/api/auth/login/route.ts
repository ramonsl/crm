import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/AuthService';
import { rateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { AppError } from '@/lib/errors/AppError';
import { handleApiError } from '@/lib/api/handleApiError';

const authService = new AuthService();

export async function POST(req: NextRequest) {
    try {
        // Rate limit by IP (before authentication) - 10 requests per minute
        const identifier = getClientIdentifier(req);
        const rateLimitResult = rateLimit(identifier, 10, 60000);

        if (!rateLimitResult.success) {
            const retryAfter = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000);
            return NextResponse.json(
                { error: 'Muitas tentativas de login. Tente novamente em 1 minuto.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(retryAfter)
                    }
                }
            );
        }

        const body = await req.json();
        const { email, password } = body;

        // Validate input
        if (!email || !password) {
            throw new AppError('Email e senha são obrigatórios', 400);
        }

        // Login user
        const result = await authService.login(email, password);

        if (!result.success) {
            throw new AppError(result.error || 'Credenciais inválidas', 401);
        }

        // Create response with session cookie
        const response = NextResponse.json({
            success: true,
            user: result.user
        });

        // Set httpOnly cookie with session ID
        response.cookies.set('session_id', result.sessionId!, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
            path: '/'
        });

        return response;
    } catch (error) {
        return handleApiError(error);
    }
}
