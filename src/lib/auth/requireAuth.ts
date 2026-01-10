/**
 * Authentication Helpers
 * 
 * Centralized authentication utilities for protecting API routes.
 * Follows SOLID principles with clear separation of concerns.
 */

import { NextRequest } from 'next/server';
import { AuthService } from '@/services/AuthService';
import type { UserRow } from '@/lib/types';

/**
 * Custom error for unauthorized access
 */
export class UnauthorizedError extends Error {
    constructor(message: string = 'Não autorizado') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

/**
 * Custom error for forbidden access (authenticated but insufficient permissions)
 */
export class ForbiddenError extends Error {
    constructor(message: string = 'Permissão negada') {
        super(message);
        this.name = 'ForbiddenError';
    }
}

/**
 * Validates user session and returns authenticated user
 * 
 * @param req - Next.js request object
 * @returns User object without password_hash
 * @throws UnauthorizedError if not authenticated or session invalid
 * 
 * @example
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   try {
 *     const user = await requireAuth(req);
 *     // User is authenticated, proceed with logic
 *   } catch (error) {
 *     if (error instanceof UnauthorizedError) {
 *       return NextResponse.json({ error: error.message }, { status: 401 });
 *     }
 *     throw error;
 *   }
 * }
 * ```
 */
export async function requireAuth(req: NextRequest): Promise<Omit<UserRow, 'password_hash'>> {
    const sessionId = req.cookies.get('session_id')?.value;

    if (!sessionId) {
        throw new UnauthorizedError('Session ID não fornecido');
    }

    const authService = new AuthService();
    const result = await authService.validateSession(sessionId);

    if (!result.valid || !result.user) {
        throw new UnauthorizedError(result.error || 'Sessão inválida');
    }

    return result.user;
}

/**
 * Validates session and checks if user has required role
 * 
 * @param req - Next.js request object
 * @param allowedRoles - Array of roles that are allowed to access the resource
 * @returns User object without password_hash
 * @throws UnauthorizedError if not authenticated
 * @throws ForbiddenError if authenticated but doesn't have required role
 * 
 * @example
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   try {
 *     const user = await requireRole(req, ['admin']);
 *     // User is admin, proceed with admin-only logic
 *   } catch (error) {
 *     if (error instanceof UnauthorizedError) {
 *       return NextResponse.json({ error: error.message }, { status: 401 });
 *     }
 *     if (error instanceof ForbiddenError) {
 *       return NextResponse.json({ error: error.message }, { status: 403 });
 *     }
 *     throw error;
 *   }
 * }
 * ```
 */
export async function requireRole(
    req: NextRequest,
    allowedRoles: string[]
): Promise<Omit<UserRow, 'password_hash'>> {
    const user = await requireAuth(req);

    if (!allowedRoles.includes(user.role)) {
        throw new ForbiddenError(`Acesso restrito. Roles permitidas: ${allowedRoles.join(', ')}`);
    }

    return user;
}
