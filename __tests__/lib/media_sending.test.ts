import * as whatsapp from '@/lib/whatsapp';
import path from 'path';

// Mock whatsapp-web.js but keep MessageMedia real if possible, or mock it to see what happens
jest.mock('whatsapp-web.js', () => {
    const actual = jest.requireActual('whatsapp-web.js');
    return {
        ...actual,
        Client: jest.fn().mockImplementation(() => ({
            on: jest.fn(),
            initialize: jest.fn().mockResolvedValue(true),
            destroy: jest.fn().mockResolvedValue(true),
            sendMessage: jest.fn().mockResolvedValue({ id: { id: 'mock_msg_id' } }),
            getNumberId: jest.fn().mockResolvedValue({ _serialized: '5551999999999@c.us' }),
        })),
        LocalAuth: jest.fn(),
    };
});

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
    }),
}));

describe('Debug Media', () => {
    it('should create MessageMedia from file path', async () => {
        // Setup global client
        const { Client } = require('whatsapp-web.js');
        (global as any).whatsappClient = new Client();
        (global as any).whatsappStatus = 'ready';

        const mediaUrl = '/uploads/test.png';
        const absolutePath = path.join(process.cwd(), 'public', mediaUrl);

        console.log('Test: Absolute path:', absolutePath);

        try {
            await whatsapp.sendMessage('5551999999999', 'Test Media', mediaUrl, 'image/png');
        } catch (e) {
            console.error('Test: Error sending message:', e);
        }
    });
});
