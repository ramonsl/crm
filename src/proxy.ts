import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Proxy for route protection (Next.js 16+ convention)
 * Validates authentication for all routes except login and auth APIs
 */
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Public paths that don't require authentication
    const publicPaths = [
        '/login',
        '/api/auth/login',
        '/api/auth/register',
    ];

    // Check if path is public or an API route
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    const isApiRoute = pathname.startsWith('/api/');

    // Allow access to public paths, API routes (they handle their own auth), and static assets
    if (isPublicPath || isApiRoute || pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico')) {
        return NextResponse.next();
    }

    // Check for session cookie (only for non-API routes)
    const sessionId = request.cookies.get('session_id')?.value;

    // If no session, redirect to login
    if (!sessionId) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Session exists, allow access
    // Note: Session validation happens in API routes for security
    return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
