/**
 * SettingsProvider Tests
 * 
 * Tests for the settings provider component.
 */

import { SettingsProvider } from '@/lib/messageQueue/SettingsProvider';
import { pool } from '@/lib/db';

// Mock database
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('SettingsProvider', () => {
    let provider: SettingsProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = new SettingsProvider();
    });

    describe('get()', () => {
        it('should return setting value when found', async () => {
            mockPoolQuery.mockResolvedValue({
                rows: [{ value: 'test-value' }]
            });

            const result = await provider.get('test_key');

            expect(result).toBe('test-value');
            expect(mockPoolQuery).toHaveBeenCalledWith(
                'SELECT value FROM settings WHERE key = $1',
                ['test_key']
            );
        });

        it('should return null when setting not found', async () => {
            mockPoolQuery.mockResolvedValue({ rows: [] });

            const result = await provider.get('nonexistent_key');

            expect(result).toBeNull();
        });

        it('should return null on database error', async () => {
            mockPoolQuery.mockRejectedValue(new Error('Database error'));

            const result = await provider.get('test_key');

            expect(result).toBeNull();
        });
    });

    describe('getMultiple()', () => {
        it('should return multiple settings', async () => {
            mockPoolQuery.mockResolvedValue({
                rows: [
                    { key: 'key1', value: 'value1' },
                    { key: 'key2', value: 'value2' }
                ]
            });

            const result = await provider.getMultiple(['key1', 'key2']);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ key: 'key1', value: 'value1' });
            expect(mockPoolQuery).toHaveBeenCalledWith(
                'SELECT key, value FROM settings WHERE key IN ($1, $2)',
                ['key1', 'key2']
            );
        });

        it('should return empty array when no settings found', async () => {
            mockPoolQuery.mockResolvedValue({ rows: [] });

            const result = await provider.getMultiple(['nonexistent1', 'nonexistent2']);

            expect(result).toEqual([]);
        });

        it('should return empty array on database error', async () => {
            mockPoolQuery.mockRejectedValue(new Error('Database error'));

            const result = await provider.getMultiple(['key1', 'key2']);

            expect(result).toEqual([]);
        });

        it('should handle single key correctly', async () => {
            mockPoolQuery.mockResolvedValue({
                rows: [{ key: 'key1', value: 'value1' }]
            });

            const result = await provider.getMultiple(['key1']);

            expect(result).toHaveLength(1);
            expect(mockPoolQuery).toHaveBeenCalledWith(
                'SELECT key, value FROM settings WHERE key IN ($1)',
                ['key1']
            );
        });
    });
});
