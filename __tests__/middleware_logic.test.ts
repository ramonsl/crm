
import { NextRequest, NextResponse } from 'next/server';
import { proxy as middleware } from '@/proxy';

// Mock NextResponse
jest.mock('next/server', () => {
    const actual = jest.requireActual('next/server');
    return {
        ...actual,
        NextResponse: {
            next: jest.fn().mockReturnValue({ type: 'next' }),
            json: jest.fn().mockImplementation((body, init) => ({ type: 'json', body, status: init?.status })),
            redirect: jest.fn().mockImplementation((url) => ({ type: 'redirect', url })),
        }
    };
});

describe('Global Security Middleware (Issue #82)', () => {
    let mockRequest: { nextUrl: { pathname: string; searchParams: URLSearchParams }; url: string; cookies: { get: jest.Mock } };

    beforeEach(() => {
        jest.clearAllMocks();

        // Basic mock request structure
        mockRequest = {
            nextUrl: {
                pathname: '/',
                searchParams: new URLSearchParams(),
            },
            url: 'http://localhost:3000',
            cookies: {
                get: jest.fn().mockReturnValue(undefined) // Default no cookie
            }
        };
    });

    it('should allow public route /login', () => {
        mockRequest.nextUrl.pathname = '/login';
        middleware(mockRequest as unknown as NextRequest);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    it('should allow public route /api/auth/login', () => {
        mockRequest.nextUrl.pathname = '/api/auth/login';
        middleware(mockRequest as unknown as NextRequest);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    it('should allow public route /api/webhooks/stripe', () => {
        mockRequest.nextUrl.pathname = '/api/webhooks/stripe';
        middleware(mockRequest as unknown as NextRequest);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    // Unauthenticated Scenarios
    it('should return 401 for unauthenticated /api/users access', () => {
        mockRequest.nextUrl.pathname = '/api/users';
        mockRequest.cookies.get.mockReturnValue(undefined); // No session

        const response = middleware(mockRequest as unknown as NextRequest) as NextResponse;

        expect(NextResponse.json).toHaveBeenCalledWith(
            { error: 'Authentication required' },
            { status: 401 }
        );
        expect(response.status).toBe(401);
    });

    it('should redirect unauthenticated /dashboard access to /login', () => {
        mockRequest.nextUrl.pathname = '/dashboard';
        mockRequest.cookies.get.mockReturnValue(undefined); // No session

        middleware(mockRequest as unknown as NextRequest);

        expect(NextResponse.redirect).toHaveBeenCalled();
        const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
        expect(redirectUrl.toString()).toContain('/login');
        expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/dashboard');
    });

    // Authenticated Scenarios
    it('should allow access to /dashboard with valid session', () => {
        mockRequest.nextUrl.pathname = '/dashboard';
        mockRequest.cookies.get.mockReturnValue({ value: 'valid-session' });

        middleware(mockRequest as unknown as NextRequest);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    it('should allow access to /api/users with valid session', () => {
        mockRequest.nextUrl.pathname = '/api/users';
        mockRequest.cookies.get.mockReturnValue({ value: 'valid-session' });

        middleware(mockRequest as unknown as NextRequest);
        expect(NextResponse.next).toHaveBeenCalled();
    });
});
