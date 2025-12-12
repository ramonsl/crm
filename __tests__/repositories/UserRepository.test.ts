/**
 * UserRepository Tests
 * Unit tests for user repository - PostgreSQL async implementation
 */

import { UserRepository } from '@/lib/repositories/UserRepository';
import { pool } from '@/lib/db';

// Mock database
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('UserRepository', () => {
    let repository: UserRepository;

    beforeEach(() => {
        repository = new UserRepository();
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new user', async () => {
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

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

            const result = await repository.create({
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User',
                role: 'user'
            });

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO users'),
                expect.arrayContaining(['test@example.com', 'hashed_password', 'Test User', 'user'])
            );
            expect(result.id).toBe(1);
            expect(result.email).toBe('test@example.com');
            expect(result.name).toBe('Test User');
        });

        it('should use default role if not provided', async () => {
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

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

            await repository.create({
                email: 'test@example.com',
                password_hash: 'hashed_password',
                name: 'Test User'
            });

            const callArgs = mockPoolQuery.mock.calls[0];
            expect(callArgs[1][3]).toBe('user'); // role parameter
        });
    });

    describe('findAll', () => {
        it('should find all users ordered by created_at DESC', async () => {
            const mockUsers = [
                {
                    id: 2,
                    email: 'user2@example.com',
                    password_hash: 'hash2',
                    name: 'User 2',
                    role: 'user',
                    active: 1,
                    created_at: '2025-12-07T12:00:00Z',
                    updated_at: '2025-12-07T12:00:00Z'
                },
                {
                    id: 1,
                    email: 'user1@example.com',
                    password_hash: 'hash1',
                    name: 'User 1',
                    role: 'admin',
                    active: 1,
                    created_at: '2025-12-06T12:00:00Z',
                    updated_at: '2025-12-06T12:00:00Z'
                }
            ];

            mockPoolQuery.mockResolvedValueOnce({ rows: mockUsers, rowCount: 2 });

            const results = await repository.findAll();

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at DESC')
            );
            expect(results).toHaveLength(2);
            expect(results[0].id).toBe(2);
        });

        it('should return empty array if no users', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const results = await repository.findAll();

            expect(results).toEqual([]);
        });
    });

    describe('findById', () => {
        it('should find user by ID', async () => {
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

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

            const result = await repository.findById(1);

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM users WHERE id = $1'),
                [1]
            );
            expect(result).toEqual(mockUser);
        });

        it('should return null if user not found', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const result = await repository.findById(999);

            expect(result).toBeNull();
        });
    });

    describe('findByEmail', () => {
        it('should find user by email', async () => {
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

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

            const result = await repository.findByEmail('test@example.com');

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM users WHERE email = $1'),
                ['test@example.com']
            );
            expect(result).toEqual(mockUser);
        });

        it('should return null if user not found', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const result = await repository.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });
    });

    describe('update', () => {
        it('should update user fields', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            await repository.update(1, {
                name: 'Updated Name',
                email: 'updated@example.com'
            });

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET'),
                expect.arrayContaining(['updated@example.com', 'Updated Name', 1])
            );
        });

        it('should not update if no fields provided', async () => {
            await repository.update(1, {});

            expect(mockPoolQuery).not.toHaveBeenCalled();
        });

        it('should update password_hash', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            await repository.update(1, {
                password_hash: 'new_hashed_password'
            });

            const query = mockPoolQuery.mock.calls[0][0];
            expect(query).toContain('password_hash = $');
        });
    });

    describe('delete', () => {
        it('should delete user by ID', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            await repository.delete(1);

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM users WHERE id = $1'),
                [1]
            );
        });
    });

    describe('count', () => {
        it('should count total users', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });

            const count = await repository.count();

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT COUNT(*)')
            );
            expect(count).toBe(5);
        });

        it('should return 0 if no users', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

            const count = await repository.count();

            expect(count).toBe(0);
        });
    });
});
