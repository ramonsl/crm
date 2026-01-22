/**
 * Authentication Helpers
 * 
 * Centralized authentication utilities for protecting API routes.
 * Follows SOLID principles with clear separation of concerns.
 */

import { NextRequest } from 'next/server';
import { AuthService } from '@/services/AuthService';
import type { UserRow } from '@/lib/types';
import { AppError } from '@/lib/errors/AppError';

/**
 * Validates user session and returns authenticated user
 * 
 * @param req - Next.js request object
 * @returns User object without password_hash
 * @throws AppError(401) if not authenticated or session invalid
 */
export async function requireAuth(req: NextRequest): Promise<Omit<UserRow, 'password_hash'>> {
    const sessionId = req.cookies.get('session_id')?.value;

    if (!sessionId) {
        throw new AppError('Session ID não fornecido', 401);
    }

    const authService = new AuthService();
    const result = await authService.validateSession(sessionId);

    if (!result.valid || !result.user) {
        throw new AppError(result.error || 'Sessão inválida', 401);
    }

    return result.user;
}

/**
 * Validates session and checks if user has required role
 * 
 * @param req - Next.js request object
 * @param allowedRoles - Array of roles that are allowed to access the resource
 * @returns User object without password_hash
 * @throws AppError(401) if not authenticated
 * @throws AppError(403) if authenticated but doesn't have required role
 */
export async function requireRole(
    req: NextRequest,
    allowedRoles: string[]
): Promise<Omit<UserRow, 'password_hash'>> {
    const user = await requireAuth(req);

    if (!allowedRoles.includes(user.role)) {
        throw new AppError(`Acesso restrito. Roles permitidas: ${allowedRoles.join(', ')}`, 403);
    }

    return user;
}
