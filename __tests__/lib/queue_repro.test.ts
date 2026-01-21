import { messageQueue } from '@/lib/messageQueue';


// Mock whatsapp-web.js
jest.mock('whatsapp-web.js', () => {
    return {
        Client: jest.fn().mockImplementation(() => ({
            on: jest.fn(),
            initialize: jest.fn().mockResolvedValue(true),
            destroy: jest.fn().mockResolvedValue(true),
            sendMessage: jest.fn().mockResolvedValue({ id: { id: 'mock_msg_id' }, ack: 1, to: 'mock_to' }),
            getNumberId: jest.fn().mockResolvedValue({ _serialized: 'mock_chat_id' }),
        })),
        LocalAuth: jest.fn(),
    };
});

// Mock DB - PostgreSQL async
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn().mockImplementation((queryStr: string) => {
            if (queryStr?.includes('settings')) {
                return Promise.resolve({
                    rows: [
                        { key: 'queue_min_delay', value: '0' },
                        { key: 'queue_max_delay', value: '0' }
                    ],
                    rowCount: 2
                });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        }),
    },
}));

// Mock whatsapp library
// Mock whatsapp library provider directly as used by QueueManager
jest.mock('@/lib/whatsapp/provider', () => ({
    sendWhatsAppMessage: jest.fn().mockResolvedValue({ id: { id: 'mock_msg_id' } }),
}));

import { messageQueue } from '@/lib/messageQueue';
import { sendWhatsAppMessage } from '@/lib/whatsapp/provider';

describe('Message Queue Reproduction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        messageQueue.clear();
        // Mock client ready
        (global as any).whatsappClient = {
            sendMessage: jest.fn().mockResolvedValue({ id: { id: 'mock_msg_id' }, ack: 1, to: 'mock_to' }),
            getNumberId: jest.fn().mockResolvedValue({ _serialized: 'mock_chat_id' }),
        };
        (global as any).whatsappStatus = 'ready';
    });

    it('should process queue item and call sendMessage with correct phone', async () => {
        // Enqueue item with phone from DB (51981636027)
        messageQueue.enqueue([{
            phone: '51981636027',
            message: 'Test message',
            name: 'Ramon'
        }]);

        // Wait for processing (it's async)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if sendMessage was called
        expect(sendWhatsAppMessage).toHaveBeenCalled();

        // Check arguments
        // It should be called with the phone exactly as passed to enqueue
        expect(sendWhatsAppMessage).toHaveBeenCalledWith('51981636027', 'Test message');
    });
});
