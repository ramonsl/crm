/**
 * SessionRepository Tests
 * Unit tests for session repository - PostgreSQL async implementation
 */

import { SessionRepository } from '@/lib/repositories/SessionRepository';
import { pool } from '@/lib/db';

// Mock database
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
}));

// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid-1234')
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('SessionRepository', () => {
    let repository: SessionRepository;

    beforeEach(() => {
        repository = new SessionRepository();
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new session with UUID', async () => {
            const mockSession = {
                id: 'test-uuid-1234',
                user_id: 1,
                expires_at: '2025-01-06T12:00:00Z',
                created_at: '2025-12-07T12:00:00Z'
            };

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockSession], rowCount: 1 });

            const result = await repository.create(1, '2025-01-06T12:00:00Z');

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO sessions'),
                expect.arrayContaining(['test-uuid-1234', 1, '2025-01-06T12:00:00Z'])
            );
            expect(result.id).toBe('test-uuid-1234');
            expect(result.user_id).toBe(1);
        });
    });

    describe('findById', () => {
        it('should find session by ID', async () => {
            const mockSession = {
                id: 'test-uuid-1234',
                user_id: 1,
                expires_at: '2025-01-06T12:00:00Z',
                created_at: '2025-12-07T12:00:00Z'
            };

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockSession], rowCount: 1 });

            const result = await repository.findById('test-uuid-1234');

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM sessions WHERE id = $1'),
                ['test-uuid-1234']
            );
            expect(result).toEqual(mockSession);
        });

        it('should return null if session not found', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const result = await repository.findById('nonexistent-uuid');

            expect(result).toBeNull();
        });
    });

    describe('findByUserId', () => {
        it('should find all sessions for a user', async () => {
            const mockSessions = [
                {
                    id: 'uuid-1',
                    user_id: 1,
                    expires_at: '2025-01-06T12:00:00Z',
                    created_at: '2025-12-07T12:00:00Z'
                },
                {
                    id: 'uuid-2',
                    user_id: 1,
                    expires_at: '2025-01-05T12:00:00Z',
                    created_at: '2025-12-06T12:00:00Z'
                }
            ];

            mockPoolQuery.mockResolvedValueOnce({ rows: mockSessions, rowCount: 2 });

            const results = await repository.findByUserId(1);

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM sessions WHERE user_id = $1'),
                [1]
            );
            expect(results).toHaveLength(2);
        });

        it('should return empty array if no sessions', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const results = await repository.findByUserId(999);

            expect(results).toEqual([]);
        });
    });

    describe('delete', () => {
        it('should delete session by ID', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            await repository.delete('test-uuid-1234');

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM sessions WHERE id = $1'),
                ['test-uuid-1234']
            );
        });
    });

    describe('deleteByUserId', () => {
        it('should delete all sessions for a user', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 });

            await repository.deleteByUserId(1);

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM sessions WHERE user_id = $1'),
                [1]
            );
        });
    });

    describe('deleteExpired', () => {
        it('should delete expired sessions', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 5 });

            await repository.deleteExpired();

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM sessions WHERE expires_at')
            );
        });
    });
});
