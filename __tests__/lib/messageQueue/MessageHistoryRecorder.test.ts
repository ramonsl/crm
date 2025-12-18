/**
 * MessageHistoryRecorder Tests
 * 
 * Tests for the message history recording component.
 */

import { MessageHistoryRecorder } from '@/lib/messageQueue/MessageHistoryRecorder';
import { pool } from '@/lib/db';
import type { QueueItem } from '@/lib/messageQueue/types';

// Mock database
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('MessageHistoryRecorder', () => {
    let recorder: MessageHistoryRecorder;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
        recorder = new MessageHistoryRecorder();
    });

    describe('recordSuccess()', () => {
        it('should insert success record into message_history', async () => {
            const item: QueueItem = {
                id: 'test-id',
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                templateId: 5,
                templateName: 'Welcome',
                status: 'completed',
                addedAt: new Date()
            };

            await recorder.recordSuccess(item);

            expect(mockPoolQuery).toHaveBeenCalledTimes(2);

            // First call: insert into message_history
            expect(mockPoolQuery.mock.calls[0][0]).toContain('INSERT INTO message_history');
            expect(mockPoolQuery.mock.calls[0][1]).toEqual([
                '12345678901', 5, 'Welcome', 'Test message'
            ]);

            // Second call: update leads
            expect(mockPoolQuery.mock.calls[1][0]).toContain('UPDATE leads');
            expect(mockPoolQuery.mock.calls[1][1]).toEqual(['Welcome', '12345678901']);
        });

        it('should not record if cpf is missing', async () => {
            const item: QueueItem = {
                id: 'test-id',
                phone: '5551999999999',
                message: 'Test message',
                templateName: 'Welcome',
                status: 'completed',
                addedAt: new Date()
            };

            await recorder.recordSuccess(item);

            expect(mockPoolQuery).not.toHaveBeenCalled();
        });

        it('should not record if templateName is missing', async () => {
            const item: QueueItem = {
                id: 'test-id',
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                status: 'completed',
                addedAt: new Date()
            };

            await recorder.recordSuccess(item);

            expect(mockPoolQuery).not.toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            mockPoolQuery.mockRejectedValue(new Error('Database error'));

            const item: QueueItem = {
                id: 'test-id',
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                templateName: 'Welcome',
                status: 'completed',
                addedAt: new Date()
            };

            // Should not throw
            await expect(recorder.recordSuccess(item)).resolves.toBeUndefined();
        });
    });

    describe('recordFailure()', () => {
        it('should insert failure record into message_history', async () => {
            const item: QueueItem = {
                id: 'test-id',
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                templateId: 5,
                templateName: 'Welcome',
                status: 'failed',
                addedAt: new Date()
            };

            await recorder.recordFailure(item);

            expect(mockPoolQuery).toHaveBeenCalledTimes(1);
            expect(mockPoolQuery.mock.calls[0][0]).toContain("'failed'");
        });

        it('should not record if cpf is missing', async () => {
            const item: QueueItem = {
                id: 'test-id',
                phone: '5551999999999',
                message: 'Test message',
                templateName: 'Welcome',
                status: 'failed',
                addedAt: new Date()
            };

            await recorder.recordFailure(item);

            expect(mockPoolQuery).not.toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            mockPoolQuery.mockRejectedValue(new Error('Database error'));

            const item: QueueItem = {
                id: 'test-id',
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                templateName: 'Welcome',
                status: 'failed',
                addedAt: new Date()
            };

            // Should not throw
            await expect(recorder.recordFailure(item)).resolves.toBeUndefined();
        });
    });
});
