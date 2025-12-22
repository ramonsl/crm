/**
 * QueueAutomationRepository Tests
 * Tests for data access layer of queue automation feature
 */

import { NeonQueueAutomationRepository } from '@/repositories/QueueAutomationRepository';

// Mock the database pool
const mockQuery = jest.fn();

jest.mock('@/lib/db', () => ({
    pool: {
        query: (...args: unknown[]) => mockQuery(...args)
    }
}));

describe('QueueAutomationRepository', () => {
    let repository: NeonQueueAutomationRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        repository = new NeonQueueAutomationRepository();
    });

    describe('getConfig', () => {
        it('should return null if no config exists', async () => {
            mockQuery.mockResolvedValue({ rows: [] });

            const result = await repository.getConfig();

            expect(result).toBeNull();
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM queue_automation_config')
            );
        });

        it('should return mapped config if exists', async () => {
            const dbRow = {
                id: 1,
                template_id: 42,
                message_type: 'ai',
                is_active: true,
                start_hour: 8,
                end_hour: 21,
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-02')
            };

            mockQuery.mockResolvedValue({ rows: [dbRow] });

            const result = await repository.getConfig();

            expect(result).not.toBeNull();
            expect(result?.id).toBe(1);
            expect(result?.templateId).toBe(42);
            expect(result?.messageType).toBe('ai');
            expect(result?.isActive).toBe(true);
            expect(result?.startHour).toBe(8);
            expect(result?.endHour).toBe(21);
        });
    });

    describe('updateConfig', () => {
        it('should update only provided fields', async () => {
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await repository.updateConfig({
                templateId: 5,
                isActive: true
            });

            expect(mockQuery).toHaveBeenCalled();
            const [query, params] = mockQuery.mock.calls[0];

            expect(query).toContain('UPDATE queue_automation_config');
            expect(query).toContain('template_id');
            expect(query).toContain('is_active');
            expect(params).toContain(5);
            expect(params).toContain(true);
        });

        it('should not execute query if no fields provided', async () => {
            await repository.updateConfig({});

            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('should update message_type when provided', async () => {
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await repository.updateConfig({ messageType: 'ai' });

            const [query, params] = mockQuery.mock.calls[0];
            expect(query).toContain('message_type');
            expect(params).toContain('ai');
        });
    });

    describe('logSend', () => {
        it('should insert log with upsert', async () => {
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await repository.logSend('12345678900', 1, true);

            expect(mockQuery).toHaveBeenCalled();
            const [query, params] = mockQuery.mock.calls[0];

            expect(query).toContain('INSERT INTO queue_automation_log');
            expect(query).toContain('ON CONFLICT');
            expect(params).toEqual(['12345678900', 1, true, null]);
        });

        it('should include error message when provided', async () => {
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await repository.logSend('12345678900', 1, false, 'Connection failed');

            const [, params] = mockQuery.mock.calls[0];
            expect(params).toEqual(['12345678900', 1, false, 'Connection failed']);
        });
    });

    describe('hasBeenContacted', () => {
        it('should return true if lead has successful log entry', async () => {
            mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });

            const result = await repository.hasBeenContacted('12345678900');

            expect(result).toBe(true);
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT 1 FROM queue_automation_log'),
                ['12345678900']
            );
        });

        it('should return false if no log entry found', async () => {
            mockQuery.mockResolvedValue({ rows: [] });

            const result = await repository.hasBeenContacted('12345678900');

            expect(result).toBe(false);
        });
    });

    describe('getLogStats', () => {
        it('should return total count and last sent timestamp', async () => {
            const lastSent = new Date('2024-01-15T10:30:00');
            mockQuery.mockResolvedValue({
                rows: [{ total: '25', last_sent: lastSent }]
            });

            const result = await repository.getLogStats();

            expect(result.totalSent).toBe(25);
            expect(result.lastSentAt).toEqual(lastSent);
        });

        it('should return 0 and null for empty log', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ total: '0', last_sent: null }]
            });

            const result = await repository.getLogStats();

            expect(result.totalSent).toBe(0);
            expect(result.lastSentAt).toBeNull();
        });
    });
});
