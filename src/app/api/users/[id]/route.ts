import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { requireAuth } from '@/lib/auth/requireAuth';

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
            return NextResponse.json(
                { error: 'Nenhum campo para atualizar' },
                { status: 400 }
            );
        }

        // Update user
        await userRepository.update(userId, { name, email, role, active });

        // Fetch updated user to return
        const updated = await userRepository.findById(userId);

        if (!updated) {
            return NextResponse.json(
                { error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        // Remove password hash before returning
        const { password_hash, ...userWithoutPassword } = updated;

        return NextResponse.json({ success: true, data: userWithoutPassword });

    } catch (error) {
        console.error('[API /api/users/[id] PUT] Error:', error);

        // Handle unauthorized error specifically if needed, but requireAuth throws it
        if ((error as Error).name === 'UnauthorizedError') {
            return NextResponse.json({ error: (error as Error).message }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
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
            return NextResponse.json(
                { error: 'Você não pode deletar sua própria conta' },
                { status: 400 }
            );
        }

        await userRepository.delete(userId);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API /api/users/[id] DELETE] Error:', error);

        if ((error as Error).name === 'UnauthorizedError') {
            return NextResponse.json({ error: (error as Error).message }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
