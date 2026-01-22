import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { requireAuth } from '@/lib/auth/requireAuth';
import { AppError } from '@/lib/errors/AppError';
import { handleApiError } from '@/lib/api/handleApiError';

const userRepository = new UserRepository();

/**
 * PUT /api/users/[id]
 * Updates a user's details
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await requireAuth(req);

        const body = await req.json();
        const { name, email, role, active } = body;
        const userId = parseInt(id);

        // Validate if any updateable field is present
        if (!name && !email && !role && active === undefined) {
            throw new AppError('Nenhum campo para atualizar', 400);
        }

        // Update user
        await userRepository.update(userId, { name, email, role, active });

        // Fetch updated user to return
        const updated = await userRepository.findById(userId);

        if (!updated) {
            throw new AppError('Usuário não encontrado', 404);
        }

        // Remove password hash before returning
        const { password_hash, ...userWithoutPassword } = updated;

        return NextResponse.json({ success: true, data: userWithoutPassword });

    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * DELETE /api/users/[id]
 * Deletes a user
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await requireAuth(req);
        const userId = parseInt(id);

        // Prevent self-deletion
        if (user.id === userId) {
            throw new AppError('Você não pode deletar sua própria conta', 400);
        }

        await userRepository.delete(userId);

        return NextResponse.json({ success: true });

    } catch (error) {
        return handleApiError(error);
    }
}
