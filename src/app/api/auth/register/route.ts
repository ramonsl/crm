import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/AuthService';
import { AppError } from '@/lib/errors/AppError';
import { handleApiError } from '@/lib/api/handleApiError';

const authService = new AuthService();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, name } = body;

        // Validate input
        if (!email || !password || !name) {
            throw new AppError('Email, senha e nome são obrigatórios', 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new AppError('Email inválido', 400);
        }

        // Validate password length
        if (password.length < 6) {
            throw new AppError('A senha deve ter no mínimo 6 caracteres', 400);
        }

        // Register user
        const result = await authService.register(email, password, name);

        if (!result.success) {
            throw new AppError(result.error || 'Erro ao criar usuário', 400);
        }

        return NextResponse.json({
            success: true,
            user: result.user
        });
    } catch (error) {
        return handleApiError(error);
    }
}
