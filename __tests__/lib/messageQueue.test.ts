import { messageQueue } from '@/lib/messageQueue';
import * as whatsapp from '@/lib/whatsapp';
import db from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/whatsapp', () => ({
    sendMessage: jest.fn().mockResolvedValue({ id: { id: 'mock_id' } }),
}));

jest.mock('@/lib/db', () => ({
    prepare: jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([
            { key: 'queue_min_delay', value: '0' },
            { key: 'queue_max_delay', value: '0' }
        ]), // Mock 0 delay
        get: jest.fn().mockReturnValue({ value: 'mock_api_key' }),
    }),
}));

describe('MessageQueue', () => {
    beforeEach(() => {
        messageQueue.clear();
        jest.clearAllMocks();
        // jest.useFakeTimers(); // Disable fake timers
    });

    afterEach(() => {
        // jest.useRealTimers();
    });

    it('should enqueue items and process them', async () => {
        const items = [{ phone: '5551999999999', message: 'Test message' }];

        messageQueue.enqueue(items);

        expect(messageQueue.getState().queueLength).toBe(1);

        // Wait for processing (real time)
        // Since delay is 0, it should be fast.
        // We wait for a loop to finish.
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log(messageQueue.getState().logs);

        expect(whatsapp.sendMessage).toHaveBeenCalledWith('5551999999999', 'Test message');
        expect(messageQueue.getState().queueLength).toBe(0);
    });

    it('should generate AI message', async () => {
        const items = [{ phone: '5551999999999', message: 'Hello {nome}', isAi: true, name: 'John' }];

        // Mock fetch for OpenAI
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                choices: [{ message: { content: 'AI Generated: Hello John' } }]
            })
        } as any);

        messageQueue.enqueue(items);

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.openai.com/v1/chat/completions',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('Hello John') // Variable substituted before AI
            })
        );

        expect(whatsapp.sendMessage).toHaveBeenCalledWith(
            '5551999999999',
            'AI Generated: Hello John'
        );
    });

    it('should handle send failure', async () => {
        (whatsapp.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

        const items = [{ phone: '5551999999999', message: 'Fail msg' }];
        messageQueue.enqueue(items);

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should be removed from queue but logged as failed
        expect(messageQueue.getState().queueLength).toBe(0);
        expect(messageQueue.getState().stats.failed).toBe(1);
    });

    it('should clear the queue and update total', () => {
        messageQueue.enqueue([{ phone: '5551999999999', message: 'test' }]);
        messageQueue.enqueue([{ phone: '5551999999998', message: 'test' }]);

        expect(messageQueue.getState().queueLength).toBe(2);
        // Total should be at least 2 (plus any from previous tests if not reset)
        const initialTotal = messageQueue.getState().stats.total;
        expect(initialTotal).toBeGreaterThanOrEqual(2);

        messageQueue.clear();

        expect(messageQueue.getState().queueLength).toBe(0);
        expect(messageQueue.getState().stats.total).toBe(initialTotal - 2);
    });
});
