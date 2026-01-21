import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/AuthService';
import { UserRepository } from '@/lib/repositories/UserRepository';

const authService = new AuthService();
const userRepository = new UserRepository();

/**
 * Helper to validate authentication
 */
async function requireAuth(req: NextRequest) {
    const sessionId = req.cookies.get('session_id')?.value;

    if (!sessionId) {
        return { authenticated: false, error: 'Não autenticado' };
    }

    const result = await authService.validateSession(sessionId);

    if (!result.valid) {
        return { authenticated: false, error: result.error || 'Sessão inválida' };
    }

    return { authenticated: true, user: result.user };
}

/**
 * GET /api/users - List all users
 */
export async function GET(req: NextRequest) {
    try {
        // Require authentication
        const auth = await requireAuth(req);
        if (!auth.authenticated) {
            return NextResponse.json(
                { error: auth.error },
                { status: 401 }
            );
        }

        // Get all users
        const users = await userRepository.findAll();

        // Remove password_hash from response
        const usersWithoutPassword = users.map(({ password_hash, ...user }) => user);

        return NextResponse.json({
            success: true,
            data: usersWithoutPassword
        });
    } catch (error) {
        console.error('[API /api/users GET] Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/users - Create new user (admin only)
 */
export async function POST(req: NextRequest) {
    try {
        // Require authentication
        const auth = await requireAuth(req);
        if (!auth.authenticated) {
            return NextResponse.json(
                { error: auth.error },
                { status: 401 }
            );
        }

        // SECURITY FIX #80: Only admins can create users
        if (auth.user?.role !== 'admin') {
            return NextResponse.json(
                { error: 'Acesso negado. Apenas administradores podem criar usuários.' },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { email, password, name, role } = body;

        // Validate input
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, senha e nome são obrigatórios' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Email inválido' },
                { status: 400 }
            );
        }

        // Validate password length
        if (password.length < 6) {
            return NextResponse.json(
                { error: 'A senha deve ter no mínimo 6 caracteres' },
                { status: 400 }
            );
        }

        // Create user
        const result = await authService.register(email, password, name);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        // Update role if provided
        if (role && result.user) {
            await userRepository.update(result.user.id, { role });
            const updatedUser = await userRepository.findById(result.user.id);
            if (updatedUser) {
                const { password_hash, ...userWithoutPassword } = updatedUser;
                return NextResponse.json({
                    success: true,
                    data: userWithoutPassword
                });
            }
        }

        return NextResponse.json({
            success: true,
            data: result.user
        });
    } catch (error) {
        console.error('[API /api/users POST] Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
