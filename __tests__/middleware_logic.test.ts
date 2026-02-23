/**
 * Unit tests for the global authentication middleware.
 * Tests public route passthrough, cookie presence check, and 401 rejection.
 * Covers Issue #107: Broken Access Control (Missing Global Middleware)
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock NextResponse to make assertions simple
jest.mock('next/server', () => {
    const actual = jest.requireActual('next/server');
    return {
        ...actual,
        NextResponse: {
            next: jest.fn().mockReturnValue({ type: 'next', status: 200 }),
            json: jest.fn().mockImplementation((body: unknown, init?: { status?: number }) => ({
                type: 'json',
                body,
                status: init?.status ?? 200,
            })),
            redirect: jest.fn().mockImplementation((url: URL | string) => ({
                type: 'redirect',
                url: url.toString(),
                status: 307,
            })),
        },
    };
});

import { proxy as middleware } from '@/proxy';

function buildMockRequest(pathname: string, sessionId?: string) {
    return {
        nextUrl: { pathname },
        url: `http://localhost${pathname}`,
        cookies: {
            get: jest.fn().mockReturnValue(sessionId ? { value: sessionId } : undefined),
        },
    } as unknown as NextRequest;
}

describe('Global Auth Middleware (#107)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('Public routes — always pass through', () => {
        const publicRoutes = [
            '/api/auth/login',
            '/api/auth/logout',
            '/api/auth/session',
            '/api/auth/register',
            '/api/health',
            '/api/ycloud/webhook',
        ];

        it.each(publicRoutes)(
            'allows %s without a session cookie',
            (path) => {
                const req = buildMockRequest(path); // no cookie
                middleware(req);
                expect(NextResponse.next).toHaveBeenCalled();
                expect(NextResponse.json).not.toHaveBeenCalled();
            }
        );
    });

    describe('Protected API routes — require session cookie', () => {
        const protectedRoutes = [
            '/api/leads',
            '/api/templates',
            '/api/users',
            '/api/settings',
            '/api/enrollments',
            '/api/whatsapp',
            '/api/dashboard',
        ];

        it.each(protectedRoutes)(
            'returns 401 for %s when no session cookie is present',
            (path) => {
                const req = buildMockRequest(path); // no cookie
                const res = middleware(req) as { status: number };
                expect(res.status).toBe(401);
                expect(NextResponse.next).not.toHaveBeenCalled();
            }
        );

        it.each(protectedRoutes)(
            'passes through %s when a session cookie is present',
            (path) => {
                const req = buildMockRequest(path, 'valid-session-id');
                middleware(req);
                expect(NextResponse.next).toHaveBeenCalled();
            }
        );
    });

    describe('Non-API page routes — never return 401', () => {
        it('allows /login without a session cookie (public page)', () => {
            const req = buildMockRequest('/login');
            middleware(req);
            expect(NextResponse.next).toHaveBeenCalled();
            expect(NextResponse.json).not.toHaveBeenCalled();
        });

        it.each(['/', '/contacts', '/vagas'])(
            'redirects protected page %s to /login when no cookie (not a 401)',
            (path) => {
                const req = buildMockRequest(path); // no cookie
                middleware(req);
                // Page routes must NEVER return a 401 JSON — only a login redirect
                expect(NextResponse.json).not.toHaveBeenCalled();
                expect(NextResponse.redirect).toHaveBeenCalled();
            }
        );
    });
});
