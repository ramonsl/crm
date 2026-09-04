import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Proxy for route protection (Next.js 16+ convention)
 * Validates authentication for all routes except login and auth APIs
 */
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Define Public Routes (Whitelist)
    const publicPaths = [
        '/login',
        '/register',
        '/favicon.ico',
        '/logo.png',
        '/landing', // Example
    ];

    const publicPrefixes = [
        '/api/auth',
        '/api/webhooks',
        '/api/public',
        '/api/health',
        '/api/ycloud/webhook',
        '/api/wuzapi/webhook', // WuzAPI chama sem sessão (chamada server-to-server)
        '/_next',
        '/static',
        '/images',
        '/api/jobs', // Bypasses edge proxy to prevent Undici fetch chunk crashing (auth handled natively)
    ];

    // Check if path is public
    const isPublic = publicPaths.includes(pathname) ||
        publicPrefixes.some(prefix => pathname.startsWith(prefix));

    if (isPublic) {
        return NextResponse.next();
    }

    // 2. Check Authentication (Session Cookie)
    const sessionId = request.cookies.get('session_id')?.value;

    // 3. Handle Unauthorized Access
    if (!sessionId) {
        // API Routes -> Return 401
        if (pathname.startsWith('/api')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Dashboard/Page Routes -> Redirect to Login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 4. Update Session (Optional)
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
