import { messageQueue } from '@/lib/messageQueue';
import * as whatsapp from '@/lib/whatsapp';
import db from '@/lib/db';
import { TEST_TIMEOUTS } from '@/lib/constants';

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
        await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.SHORT));

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
        await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.SHORT));

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
        await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.SHORT));

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

    describe('Message History Recording', () => {
        let mockInsertHistory: jest.Mock;
        let mockUpdateLead: jest.Mock;

        beforeEach(() => {
            mockInsertHistory = jest.fn();
            mockUpdateLead = jest.fn();

            (db.prepare as jest.Mock).mockImplementation((query) => {
                if (query.includes('INSERT INTO message_history')) {
                    return { run: mockInsertHistory };
                }
                if (query.includes('UPDATE leads SET last_template_name')) {
                    return { run: mockUpdateLead };
                }
                // Default for settings queries
                return {
                    all: jest.fn().mockReturnValue([
                        { key: 'queue_min_delay', value: '0' },
                        { key: 'queue_max_delay', value: '0' }
                    ]),
                    get: jest.fn().mockReturnValue({ value: 'mock_api_key' })
                };
            });
        });

        it('should record message history on successful send', async () => {
            const items = [{
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                templateId: 5,
                templateName: 'Boas-vindas'
            }];

            messageQueue.enqueue(items);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.STANDARD));

            expect(mockInsertHistory).toHaveBeenCalledWith(
                '12345678901',
                5,
                'Boas-vindas',
                'Test message'
            );
        });

        it('should update last_template_name on successful send', async () => {
            const items = [{
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                templateName: 'Boas-vindas'
            }];

            messageQueue.enqueue(items);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockUpdateLead).toHaveBeenCalledWith(
                'Boas-vindas',
                '12345678901'
            );
        });

        it('should record failed message in history', async () => {
            (whatsapp.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

            const items = [{
                phone: '5551999999999',
                message: 'Fail msg',
                cpf: '12345678901',
                templateName: 'Test Template'
            }];

            messageQueue.enqueue(items);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockInsertHistory).toHaveBeenCalledWith(
                '12345678901',
                null,
                'Test Template',
                'Fail msg'
            );
        });

        it('should handle manual messages (no template)', async () => {
            const items = [{
                phone: '5551999999999',
                message: 'Manual message',
                cpf: '12345678901',
                templateName: 'Mensagem Manual'
            }];

            messageQueue.enqueue(items);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockInsertHistory).toHaveBeenCalledWith(
                '12345678901',
                null,
                'Mensagem Manual',
                'Manual message'
            );
        });

        it('should not fail send if history recording fails', async () => {
            mockInsertHistory.mockImplementation(() => {
                throw new Error('Database error');
            });

            const items = [{
                phone: '5551999999999',
                message: 'Test message',
                cpf: '12345678901',
                templateName: 'Test Template'
            }];

            messageQueue.enqueue(items);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 150));

            // Message should still be sent successfully
            expect(whatsapp.sendMessage).toHaveBeenCalledWith('5551999999999', 'Test message');
            expect(messageQueue.getState().stats.processed).toBeGreaterThan(0);
        });

        it('should not record history if cpf or templateName is missing', async () => {
            const items = [{
                phone: '5551999999999',
                message: 'Test message'
                // No cpf or templateName
            }];

            messageQueue.enqueue(items);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should not attempt to insert history
            expect(mockInsertHistory).not.toHaveBeenCalled();
            expect(mockUpdateLead).not.toHaveBeenCalled();
        });

        it('should record AI-generated messages', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    choices: [{ message: { content: 'AI Generated Message' } }]
                })
            } as any);

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

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.LONG));

            // Should record the AI-generated content
            expect(mockInsertHistory).toHaveBeenCalledWith(
                '12345678901',
                10,
                'AI Prompt Template',
                'AI Generated Message'
            );
        });
    });
});
