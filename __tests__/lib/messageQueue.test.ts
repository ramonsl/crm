import { messageQueue } from '@/lib/messageQueue';
import { pool } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/whatsapp', () => ({
    sendMessage: jest.fn().mockResolvedValue({ id: { id: 'mock_id' } }),
}));

jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn().mockResolvedValue({
            rows: [
                { key: 'queue_min_delay', value: '0' },
                { key: 'queue_max_delay', value: '0' }
            ],
            rowCount: 2
        }),
    },
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('MessageQueue', () => {
    beforeEach(() => {
        messageQueue.clear();
        jest.clearAllMocks();
        // Reset mock to default
        mockPoolQuery.mockResolvedValue({
            rows: [
                { key: 'queue_min_delay', value: '0' },
                { key: 'queue_max_delay', value: '0' }
            ],
            rowCount: 2
        });
    });

    it('should enqueue items correctly', () => {
        const items = [{ phone: '5551999999999', message: 'Test message' }];

        messageQueue.enqueue(items);

        expect(messageQueue.getState().queueLength).toBeGreaterThanOrEqual(1);
        expect(messageQueue.getState().stats.total).toBeGreaterThanOrEqual(1);
    });

    it('should clear the queue and update total', () => {
        messageQueue.enqueue([{ phone: '5551999999999', message: 'test' }]);
        messageQueue.enqueue([{ phone: '5551999999998', message: 'test' }]);

        const beforeClear = messageQueue.getState().queueLength;
        expect(beforeClear).toBeGreaterThanOrEqual(2);

        messageQueue.clear();

        expect(messageQueue.getState().queueLength).toBe(0);
    });

    it('should get queue state', () => {
        const state = messageQueue.getState();

        expect(state).toHaveProperty('queueLength');
        expect(state).toHaveProperty('processing');
        expect(state).toHaveProperty('stats');
        expect(state).toHaveProperty('logs');
    });

    describe('Message Enqueue Options', () => {
        it('should enqueue with template info', () => {
            const items = [{
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                templateId: 5,
                templateName: 'Boas-vindas'
            }];

            messageQueue.enqueue(items);

            expect(messageQueue.getState().stats.total).toBeGreaterThan(0);
        });

        it('should enqueue AI messages with correct options', () => {
            const items = [{
                phone: '5551999999999',
                message: 'Generate message for {nome}',
                isAi: true,
                name: 'John',
                cpf: '12345678901',
                templateId: 10,
                templateName: 'AI Prompt Template'
            }];

            messageQueue.enqueue(items);

            expect(messageQueue.getState().stats.total).toBeGreaterThan(0);
        });

        it('should enqueue multiple items', () => {
            const items = [
                { phone: '5551999999999', message: 'Test 1' },
                { phone: '5551888888888', message: 'Test 2' },
                { phone: '5551777777777', message: 'Test 3' }
            ];

            messageQueue.enqueue(items);

            expect(messageQueue.getState().queueLength).toBeGreaterThanOrEqual(3);
        });
    });
});
