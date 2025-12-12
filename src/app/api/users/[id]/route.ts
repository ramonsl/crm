import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/AuthService';
import { UserRepository } from '@/lib/repositories/UserRepository';
import bcrypt from 'bcryptjs';

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
 * GET /api/users/[id] - Get user by ID
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require authentication
        const auth = await requireAuth(req);
        if (!auth.authenticated) {
            return NextResponse.json(
                { error: auth.error },
                { status: 401 }
            );
        }

        const { id } = await params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json(
                { error: 'ID inválido' },
                { status: 400 }
            );
        }

        const user = await userRepository.findById(userId);

        if (!user) {
            return NextResponse.json(
                { error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        // Remove password_hash from response
        const { password_hash, ...userWithoutPassword } = user;

        return NextResponse.json({
            success: true,
            data: userWithoutPassword
        });
    } catch (error) {
        console.error('[API /api/users/[id] GET] Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/users/[id] - Update user
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require authentication
        const auth = await requireAuth(req);
        if (!auth.authenticated) {
            return NextResponse.json(
                { error: auth.error },
                { status: 401 }
            );
        }

        const { id } = await params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json(
                { error: 'ID inválido' },
                { status: 400 }
            );
        }

        const user = await userRepository.findById(userId);

        if (!user) {
            return NextResponse.json(
                { error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        const body = await req.json();
        const { email, password, name, role, active } = body;

        // Build update data
        const updateData: any = {};

        if (email !== undefined) {
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return NextResponse.json(
                    { error: 'Email inválido' },
                    { status: 400 }
                );
            }
            updateData.email = email;
        }

        if (password !== undefined && password !== '') {
            // Validate password length
            if (password.length < 6) {
                return NextResponse.json(
                    { error: 'A senha deve ter no mínimo 6 caracteres' },
                    { status: 400 }
                );
            }
            // Hash new password
            updateData.password_hash = await bcrypt.hash(password, 10);
        }

        if (name !== undefined) {
            updateData.name = name;
        }

        if (role !== undefined) {
            updateData.role = role;
        }

        if (active !== undefined) {
            updateData.active = active ? 1 : 0;
        }

        // Update user
        await userRepository.update(userId, updateData);

        // Return updated user
        const updatedUser = await userRepository.findById(userId);
        const { password_hash, ...userWithoutPassword } = updatedUser!;

        return NextResponse.json({
            success: true,
            data: userWithoutPassword
        });
    } catch (error) {
        console.error('[API /api/users/[id] PUT] Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/users/[id] - Delete user
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require authentication
        const auth = await requireAuth(req);
        if (!auth.authenticated) {
            return NextResponse.json(
                { error: auth.error },
                { status: 401 }
            );
        }

        const { id } = await params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json(
                { error: 'ID inválido' },
                { status: 400 }
            );
        }

        const user = await userRepository.findById(userId);

        if (!user) {
            return NextResponse.json(
                { error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        // Prevent deleting yourself
        if (auth.user && auth.user.id === userId) {
            return NextResponse.json(
                { error: 'Você não pode deletar sua própria conta' },
                { status: 400 }
            );
        }

        // Delete user
        await userRepository.delete(userId);

        return NextResponse.json({
            success: true,
            message: 'Usuário deletado com sucesso'
        });
    } catch (error) {
        console.error('[API /api/users/[id] DELETE] Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
