
import { NextRequest } from 'next/server';

describe('User Management API', () => {
    let PUT: any, DELETE: any, POST_PASSWORD: any;

    // Define mock functions in the scope where they are accessible
    const mockUpdate = jest.fn();
    const mockDelete = jest.fn();
    const mockFindById = jest.fn();
    const mockChangePassword = jest.fn();
    const mockRequireAuthFn = jest.fn();

    beforeEach(() => {
        jest.resetModules(); // Important: Clears cache so next require triggers new module evaluation
        jest.clearAllMocks(); // Clear spy history

        // Use doMock to define mocks that use the variables above
        // doMock is NOT hoisted, so it runs here, after variables are defined
        jest.doMock('@/lib/repositories/UserRepository', () => ({
            UserRepository: jest.fn().mockImplementation(() => ({
                update: mockUpdate,
                delete: mockDelete,
                findById: mockFindById,
            }))
        }));

        jest.doMock('@/services/AuthService', () => ({
            AuthService: jest.fn().mockImplementation(() => ({
                changePassword: mockChangePassword
            }))
        }));

        jest.doMock('@/lib/auth/requireAuth', () => ({
            requireAuth: mockRequireAuthFn,
            UnauthorizedError: class UnauthorizedError extends Error { },
        }));

        // Re-import routes
        const usersRoute = require('@/app/api/users/[id]/route');
        PUT = usersRoute.PUT;
        DELETE = usersRoute.DELETE;

        const passwordRoute = require('@/app/api/users/[id]/password/route');
        POST_PASSWORD = passwordRoute.POST;
    });

    describe('PUT /api/users/[id]', () => {
        it('should update user successfully', async () => {
            mockRequireAuthFn.mockResolvedValue({ id: 1, role: 'admin' });
            mockFindById.mockResolvedValue({ id: 2, name: 'Updated Name', email: 'test@test.com' });

            const req = new NextRequest('http://localhost/api/users/2', {
                method: 'PUT',
                body: JSON.stringify({ name: 'Updated Name' })
            });

            const res = await PUT(req, { params: Promise.resolve({ id: '2' }) });
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(mockUpdate).toHaveBeenCalledWith(2, expect.objectContaining({ name: 'Updated Name' }));
        });

        it('should return 400 if no fields provided', async () => {
            mockRequireAuthFn.mockResolvedValue({ id: 1, role: 'admin' });

            const req = new NextRequest('http://localhost/api/users/2', {
                method: 'PUT',
                body: JSON.stringify({})
            });

            const res = await PUT(req, { params: Promise.resolve({ id: '2' }) });
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Nenhum campo para atualizar');
        });
    });

    describe('DELETE /api/users/[id]', () => {
        it('should delete user successfully', async () => {
            mockRequireAuthFn.mockResolvedValue({ id: 1, role: 'admin' });

            const req = new NextRequest('http://localhost/api/users/2', {
                method: 'DELETE'
            });

            const res = await DELETE(req, { params: Promise.resolve({ id: '2' }) });
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(mockDelete).toHaveBeenCalledWith(2);
        });

        it('should prevent self-deletion', async () => {
            mockRequireAuthFn.mockResolvedValue({ id: 1, role: 'admin' });

            const req = new NextRequest('http://localhost/api/users/1', {
                method: 'DELETE'
            });

            const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) });
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Você não pode deletar sua própria conta');
        });
    });

    describe('POST /api/users/[id]/password', () => {
        it('should allow admin to change any password', async () => {
            mockRequireAuthFn.mockResolvedValue({ id: 1, role: 'admin' });

            const req = new NextRequest('http://localhost/api/users/2/password', {
                method: 'POST',
                body: JSON.stringify({ newPassword: 'newpassword123' })
            });

            const res = await POST_PASSWORD(req, { params: Promise.resolve({ id: '2' }) });
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(mockChangePassword).toHaveBeenCalledWith(2, 'newpassword123');
        });

        it('should allow user to change own password', async () => {
            mockRequireAuthFn.mockResolvedValue({ id: 2, role: 'user' });

            const req = new NextRequest('http://localhost/api/users/2/password', {
                method: 'POST',
                body: JSON.stringify({ newPassword: 'newpassword123' })
            });

            const res = await POST_PASSWORD(req, { params: Promise.resolve({ id: '2' }) });
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(mockChangePassword).toHaveBeenCalledWith(2, 'newpassword123');
        });

        it('should deny user changing other password', async () => {
            mockRequireAuthFn.mockResolvedValue({ id: 2, role: 'user' });

            const req = new NextRequest('http://localhost/api/users/3/password', {
                method: 'POST',
                body: JSON.stringify({ newPassword: 'newpassword123' })
            });

            const res = await POST_PASSWORD(req, { params: Promise.resolve({ id: '3' }) });

            expect(res.status).toBe(403);
        });

        it('should validate password length', async () => {
            mockRequireAuthFn.mockResolvedValue({ id: 1, role: 'admin' });

            const req = new NextRequest('http://localhost/api/users/2/password', {
                method: 'POST',
                body: JSON.stringify({ newPassword: '123' })
            });

            const res = await POST_PASSWORD(req, { params: Promise.resolve({ id: '2' }) });

            expect(res.status).toBe(400);
        });
    });
});
