/**
 * Global Authentication Middleware
 *
 * Protects all /api/ routes by requiring a valid session cookie.
 * Resolves Issue #107: Broken Access Control (Missing Global Middleware)
 *
 * Architecture:
 * - Runs at the Edge before any Route Handler is executed.
 * - Allowlisted public routes bypass the check.
 * - All other /api/ routes require a `session_id` cookie.
 *
 * NOTE: This middleware only verifies that a session cookie is present.
 * Full session validation (DB lookup) is still performed by `requireAuth()`
 * inside individual route handlers that need the authenticated user object.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Routes that do NOT require authentication.
 * Prefer prefix matching where possible (startsWith) to cover
 * sub-routes automatically (e.g. /api/auth covers all auth sub-routes).
 */
const PUBLIC_API_PREFIXES = [
    '/api/auth/',          // login, logout, session, register
    '/api/health',         // health-check endpoint
    '/api/ycloud/webhook', // external webhook – no browser cookie
];

export function middleware(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl;

    // Only protect API routes
    if (!pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Allow public routes to pass through without authentication
    const isPublic = PUBLIC_API_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
    );

    if (isPublic) {
        return NextResponse.next();
    }

    // Reject requests with no session cookie
    const sessionId = request.cookies.get('session_id')?.value;

    if (!sessionId) {
        return NextResponse.json(
            { error: 'Não autorizado. Faça login para continuar.' },
            { status: 401 }
        );
    }

    return NextResponse.next();
}

export const config = {
    /**
     * Match only API routes, excluding Next.js internals and static assets.
     */
    matcher: ['/api/:path*'],
};
