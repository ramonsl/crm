import { NextRequest } from 'next/server';
import { AuthService } from '@/services/AuthService';
import { UserRepository } from '@/lib/repositories/UserRepository';

// Mock factories
jest.mock('@/services/AuthService');
jest.mock('@/lib/repositories/UserRepository');

describe('Security Audit: Privilege Escalation in /api/users', () => {
    let POST: any;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset modules and re-require route to capture fresh mock instances
        jest.isolateModules(() => {
            POST = require('@/app/api/users/route').POST;
        });
    });

    it('SECURITY FIX: blocks REGULAR user from creating users (returns 403)', async () => {
        // Access the mocked instances - they should exist after route require
        const authServiceMock = (AuthService as unknown as jest.Mock).mock.instances[0];
        const userRepoMock = (UserRepository as unknown as jest.Mock).mock.instances[0];

        // Verify mocks are captured
        if (!authServiceMock) {
            throw new Error('AuthService mock instance not found. Constructor not called?');
        }

        // 1. Setup - Mock a regular user session (NOT admin)
        authServiceMock.validateSession.mockResolvedValue({
            valid: true,
            user: { id: 1, name: 'Regular User', role: 'user', email: 'user@test.com' }
        });

        // 4. Attack Payload - Requesting 'admin' role
        const req = {
            cookies: { get: () => ({ value: 'valid-session-id' }) },
            json: async () => ({
                email: 'hacker@test.com',
                password: 'password123',
                name: 'Hacker',
                role: 'admin'
            })
        } as unknown as NextRequest;

        // 5. Execute
        const response = await POST(req);
        const data = await response.json();

        // 6. Verification - Access should be DENIED
        expect(response.status).toBe(403);
        expect(data.error).toContain('Acesso negado');

        // Ensure no user was created
        expect(userRepoMock.update).not.toHaveBeenCalled();
        expect(authServiceMock.register).not.toHaveBeenCalled();

        console.log('SECURITY FIX VERIFIED: Regular user blocked from creating users.');
    });

    it('SECURITY FIX: allows ADMIN user to create users', async () => {
        const authServiceMock = (AuthService as unknown as jest.Mock).mock.instances[0];
        const userRepoMock = (UserRepository as unknown as jest.Mock).mock.instances[0];

        if (!authServiceMock) {
            throw new Error('AuthService mock instance not found.');
        }

        // 1. Setup - Mock an ADMIN user session
        authServiceMock.validateSession.mockResolvedValue({
            valid: true,
            user: { id: 1, name: 'Admin User', role: 'admin', email: 'admin@test.com' }
        });

        // 2. Setup - Mock registration success
        const newUserId = 999;
        authServiceMock.register.mockResolvedValue({
            success: true,
            user: { id: newUserId, name: 'New User', role: 'user', email: 'new@test.com' }
        });

        // 3. Request payload
        const req = {
            cookies: { get: () => ({ value: 'valid-session-id' }) },
            json: async () => ({
                email: 'new@test.com',
                password: 'password123',
                name: 'New User'
            })
        } as unknown as NextRequest;

        // 4. Execute
        const response = await POST(req);
        const data = await response.json();

        // 5. Verification - Access should be ALLOWED
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(authServiceMock.register).toHaveBeenCalled();

        console.log('SECURITY FIX VERIFIED: Admin user allowed to create users.');
    });
});

