/**
 * Database Tests
 * Tests for the PostgreSQL database abstraction layer
 */

import { pool, query, queryOne, execute } from '@/lib/db';

// Mock the neonDb module
jest.mock('@/lib/neonDb', () => ({
    pool: {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: jest.fn().mockResolvedValue({
            query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
            release: jest.fn(),
        }),
    },
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    queryOne: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue({ rowCount: 0 }),
    transaction: jest.fn().mockImplementation(async (callback: (client: unknown) => Promise<unknown>) => callback({})),
    sql: jest.fn(),
}));

describe('Database', () => {
    it('should export pool object', () => {
        expect(pool).toBeDefined();
        expect(pool.query).toBeDefined();
    });

    it('should export query function', () => {
        expect(query).toBeDefined();
        expect(typeof query).toBe('function');
    });

    it('should export queryOne function', () => {
        expect(queryOne).toBeDefined();
        expect(typeof queryOne).toBe('function');
    });

    it('should export execute function', () => {
        expect(execute).toBeDefined();
        expect(typeof execute).toBe('function');
    });

    describe('PostgreSQL Schema', () => {
        it('should use async pool.query for database operations', async () => {
            // The new db module uses async pool.query internally
            // This test verifies the async nature of our database layer
            const result = await pool.query('SELECT 1');
            expect(result).toBeDefined();
        });
    });
});
