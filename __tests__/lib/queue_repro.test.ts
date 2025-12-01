
import { messageQueue } from '@/lib/messageQueue';
import * as whatsapp from '@/lib/whatsapp';

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

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn().mockImplementation((...args) => {
            if (args.includes('queue_min_delay')) {
                return [
                    { key: 'queue_min_delay', value: '0' },
                    { key: 'queue_max_delay', value: '0' }
                ];
            }
            return [];
        }),
    }),
    default: {
        prepare: jest.fn().mockReturnValue({
            run: jest.fn(),
            get: jest.fn(),
            all: jest.fn().mockImplementation((...args) => {
                if (args.includes('queue_min_delay')) {
                    return [
                        { key: 'queue_min_delay', value: '0' },
                        { key: 'queue_max_delay', value: '0' }
                    ];
                }
                return [];
            }),
        }),
    }
}));

// Spy on sendMessage
const sendMessageSpy = jest.spyOn(whatsapp, 'sendMessage');

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
        // We can't easily await the private process method, but we can wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if sendMessage was called
        expect(sendMessageSpy).toHaveBeenCalled();

        // Check arguments
        // It should be called with the phone exactly as passed to enqueue
        expect(sendMessageSpy).toHaveBeenCalledWith('51981636027', 'Test message');
    });
});
