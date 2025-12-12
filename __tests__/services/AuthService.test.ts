/**
 * AuthService Tests
 * Unit tests for authentication service - PostgreSQL async implementation
 * 
 * Tests registration, login, logout, and session validation
 */

import { AuthService } from '@/services/AuthService';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SessionRepository } from '@/lib/repositories/SessionRepository';
import bcrypt from 'bcryptjs';

// Mock repositories
jest.mock('@/lib/repositories/UserRepository');
jest.mock('@/lib/repositories/SessionRepository');
jest.mock('@/lib/db', () => ({
    pool: { query: jest.fn() }
}));

// Mock bcrypt
jest.mock('bcryptjs');

describe('AuthService', () => {
    let authService: AuthService;
    let mockUserRepo: jest.Mocked<UserRepository>;
    let mockSessionRepo: jest.Mocked<SessionRepository>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mocked instances
        mockUserRepo = new UserRepository() as jest.Mocked<UserRepository>;
        mockSessionRepo = new SessionRepository() as jest.Mocked<SessionRepository>;

        // Mock constructor to return our mocked instances
        (UserRepository as jest.Mock).mockImplementation(() => mockUserRepo);
        (SessionRepository as jest.Mock).mockImplementation(() => mockSessionRepo);

        authService = new AuthService();
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User',
                role: 'user',
                active: 1,
                created_at: '2025-12-07T12:00:00Z',
                updated_at: '2025-12-07T12:00:00Z'
            };

            mockUserRepo.findByEmail = jest.fn().mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
            mockUserRepo.create = jest.fn().mockResolvedValue(mockUser);

            const result = await authService.register('test@example.com', 'password123', 'Test User');

            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user?.email).toBe('test@example.com');
            expect(result.user).not.toHaveProperty('password_hash');
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
        });

        it('should fail if email already exists', async () => {
            const existingUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: 'hash',
                name: 'Existing User',
                role: 'user',
                active: 1,
                created_at: '2025-12-07T12:00:00Z',
                updated_at: '2025-12-07T12:00:00Z'
            };

            mockUserRepo.findByEmail = jest.fn().mockResolvedValue(existingUser);

            const result = await authService.register('test@example.com', 'password123', 'Test User');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Email já cadastrado');
        });

        it('should fail if required fields are missing', async () => {
            const result = await authService.register('', 'password123', 'Test User');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Email, senha e nome são obrigatórios');
        });
    });

    describe('login', () => {
        it('should login user successfully', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User',
                role: 'user',
                active: 1,
                created_at: '2025-12-07T12:00:00Z',
                updated_at: '2025-12-07T12:00:00Z'
            };

            const mockSession = {
                id: 'session-uuid',
                user_id: 1,
                expires_at: '2025-01-06T12:00:00Z',
                created_at: '2025-12-07T12:00:00Z'
            };

            mockUserRepo.findByEmail = jest.fn().mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            mockSessionRepo.create = jest.fn().mockResolvedValue(mockSession);

            const result = await authService.login('test@example.com', 'password123');

            expect(result.success).toBe(true);
            expect(result.sessionId).toBe('session-uuid');
            expect(result.user).toBeDefined();
            expect(result.user).not.toHaveProperty('password_hash');
        });

        it('should fail if user not found', async () => {
            mockUserRepo.findByEmail = jest.fn().mockResolvedValue(null);

            const result = await authService.login('nonexistent@example.com', 'password123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Email ou senha inválidos');
        });

        it('should fail if password is incorrect', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User',
                role: 'user',
                active: 1,
                created_at: '2025-12-07T12:00:00Z',
                updated_at: '2025-12-07T12:00:00Z'
            };

            mockUserRepo.findByEmail = jest.fn().mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const result = await authService.login('test@example.com', 'wrongpassword');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Email ou senha inválidos');
        });

        it('should fail if user is inactive', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User',
                role: 'user',
                active: 0,
                created_at: '2025-12-07T12:00:00Z',
                updated_at: '2025-12-07T12:00:00Z'
            };

            mockUserRepo.findByEmail = jest.fn().mockResolvedValue(mockUser);

            const result = await authService.login('test@example.com', 'password123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Usuário desativado');
        });
    });

    describe('logout', () => {
        it('should delete session on logout', async () => {
            mockSessionRepo.delete = jest.fn().mockResolvedValue(undefined);

            await authService.logout('session-uuid');

            expect(mockSessionRepo.delete).toHaveBeenCalledWith('session-uuid');
        });
    });

    describe('validateSession', () => {
        it('should validate valid session', async () => {
            const mockSession = {
                id: 'session-uuid',
                user_id: 1,
                expires_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                created_at: '2025-12-07T12:00:00Z'
            };

            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User',
                role: 'user',
                active: 1,
                created_at: '2025-12-07T12:00:00Z',
                updated_at: '2025-12-07T12:00:00Z'
            };

            mockSessionRepo.findById = jest.fn().mockResolvedValue(mockSession);
            mockUserRepo.findById = jest.fn().mockResolvedValue(mockUser);

            const result = await authService.validateSession('session-uuid');

            expect(result.valid).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user).not.toHaveProperty('password_hash');
        });

        it('should fail if session not found', async () => {
            mockSessionRepo.findById = jest.fn().mockResolvedValue(null);

            const result = await authService.validateSession('nonexistent-uuid');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Sessão não encontrada');
        });

        it('should fail if session is expired', async () => {
            const mockSession = {
                id: 'session-uuid',
                user_id: 1,
                expires_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
                created_at: '2025-12-06T12:00:00Z'
            };

            mockSessionRepo.findById = jest.fn().mockResolvedValue(mockSession);
            mockSessionRepo.delete = jest.fn().mockResolvedValue(undefined);

            const result = await authService.validateSession('session-uuid');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Sessão expirada');
            expect(mockSessionRepo.delete).toHaveBeenCalledWith('session-uuid');
        });

        it('should fail if user is inactive', async () => {
            const mockSession = {
                id: 'session-uuid',
                user_id: 1,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                created_at: '2025-12-07T12:00:00Z'
            };

            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User',
                role: 'user',
                active: 0,
                created_at: '2025-12-07T12:00:00Z',
                updated_at: '2025-12-07T12:00:00Z'
            };

            mockSessionRepo.findById = jest.fn().mockResolvedValue(mockSession);
            mockUserRepo.findById = jest.fn().mockResolvedValue(mockUser);

            const result = await authService.validateSession('session-uuid');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Usuário desativado');
        });
    });

    describe('getUserFromSession', () => {
        it('should return user if session is valid', async () => {
            const mockSession = {
                id: 'session-uuid',
                user_id: 1,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                created_at: '2025-12-07T12:00:00Z'
            };

            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User',
                role: 'user',
                active: 1,
                created_at: '2025-12-07T12:00:00Z',
                updated_at: '2025-12-07T12:00:00Z'
            };

            mockSessionRepo.findById = jest.fn().mockResolvedValue(mockSession);
            mockUserRepo.findById = jest.fn().mockResolvedValue(mockUser);

            const result = await authService.getUserFromSession('session-uuid');

            expect(result).toBeDefined();
            expect(result?.email).toBe('test@example.com');
        });

        it('should return null if session is invalid', async () => {
            mockSessionRepo.findById = jest.fn().mockResolvedValue(null);

            const result = await authService.getUserFromSession('invalid-uuid');

            expect(result).toBeNull();
        });
    });

    describe('cleanupExpiredSessions', () => {
        it('should call deleteExpired on session repository', async () => {
            mockSessionRepo.deleteExpired = jest.fn().mockResolvedValue(undefined);

            await authService.cleanupExpiredSessions();

            expect(mockSessionRepo.deleteExpired).toHaveBeenCalled();
        });
    });
});
