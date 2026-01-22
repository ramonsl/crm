import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/AuthService';
import { requireAuth } from '@/lib/auth/requireAuth';
import { AppError } from '@/lib/errors/AppError';
import { handleApiError } from '@/lib/api/handleApiError';

const authService = new AuthService();

/**
 * POST /api/users/[id]/password
 * Changes a user's password
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const currentUser = await requireAuth(req);

        const body = await req.json();
        const { newPassword } = body;
        const targetUserId = parseInt(id);

        // Validate password
        if (!newPassword || newPassword.length < 6) {
            throw new AppError('A senha deve ter no mínimo 6 caracteres', 400);
        }

        // Only allow changing own password or if admin
        // Note: currentUser.role might be typed as string, ensuring admin check works
        const isAdmin = currentUser.role === 'admin';
        const isOwnAccount = currentUser.id === targetUserId;

        if (!isOwnAccount && !isAdmin) {
            throw new AppError('Permissão negada', 403);
        }

        // Change password
        await authService.changePassword(targetUserId, newPassword);

        return NextResponse.json({ success: true });

    } catch (error) {
        return handleApiError(error);
    }
}
