
// Mock whatsapp-web.js BEFORE import
jest.mock('whatsapp-web.js', () => {
    return {
        Client: jest.fn().mockImplementation(() => ({
            on: jest.fn(),
            initialize: jest.fn().mockResolvedValue(true),
            destroy: jest.fn(),
            sendMessage: jest.fn(),
            getProfilePicUrl: jest.fn(),
            getNumberId: jest.fn()
        })),
        LocalAuth: jest.fn(),
        MessageMedia: {
            fromUrl: jest.fn(),
        }
    };
});

import { handleMessageCreate } from '@/lib/whatsapp';
import db from '@/lib/db';
import { messageQueue } from '@/lib/messageQueue';

// Mock dependencies
jest.mock('@/lib/db', () => ({
    prepare: jest.fn()
}));

jest.mock('@/lib/messageQueue', () => ({
    messageQueue: {
        addLog: jest.fn()
    }
}));

// Mock fs and path
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn()
}));

jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
    basename: jest.fn(path => path.split('/').pop())
}));

// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid')
}));

describe('Auto-Reply Feature', () => {
    let mockMsg: any;
    let mockDbPrepare: jest.Mock;
    let mockDbGet: jest.Mock;
    let mockDbRun: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDbRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
        mockDbGet = jest.fn().mockReturnValue({ cpf: '123', nome: 'Test User', telefone: '5551999999999' });
        mockDbPrepare = db.prepare as jest.Mock;
        mockDbPrepare.mockReturnValue({
            get: mockDbGet,
            run: mockDbRun
        });

        mockMsg = {
            from: '5551999999999@c.us',
            to: '5551888888888@c.us',
            body: '',
            fromMe: false,
            timestamp: 1672531200, // 2023-01-01 00:00:00
            hasMedia: false,
            id: { id: 'msg-id-123' },
            reply: jest.fn().mockResolvedValue(true),
            getContact: jest.fn().mockResolvedValue({ name: 'Test User', number: '5551999999999' })
        };
    });

    it('should send auto-reply when message contains "tem aula hoje?"', async () => {
        mockMsg.body = 'Olá, tem aula hoje?';

        await handleMessageCreate(mockMsg);

        expect(mockMsg.reply).toHaveBeenCalledWith('Por qual motivo não teriamos?');
        expect(messageQueue.addLog).toHaveBeenCalledWith(expect.stringContaining('Auto-resposta enviada'), 'success');
    });

    it('should send auto-reply when message contains "Tem aula hoje" (case insensitive)', async () => {
        mockMsg.body = 'Bom dia, Tem aula hoje';

        await handleMessageCreate(mockMsg);

        expect(mockMsg.reply).toHaveBeenCalledWith('Por qual motivo não teriamos?');
    });

    it('should NOT send auto-reply when message does not contain the phrase', async () => {
        mockMsg.body = 'Olá, tudo bem?';

        await handleMessageCreate(mockMsg);

        expect(mockMsg.reply).not.toHaveBeenCalled();
    });

    it('should NOT send auto-reply for outgoing messages', async () => {
        mockMsg.fromMe = true;
        mockMsg.body = 'tem aula hoje?';
        // Swap from/to for outgoing
        mockMsg.from = '5551888888888@c.us';
        mockMsg.to = '5551999999999@c.us';

        await handleMessageCreate(mockMsg);

        expect(mockMsg.reply).not.toHaveBeenCalled();
    });

    it('should continue to save the message even if auto-reply is sent', async () => {
        mockMsg.body = 'tem aula hoje?';

        await handleMessageCreate(mockMsg);

        expect(mockMsg.reply).toHaveBeenCalled();

        // Verify message was saved to DB
        expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE INTO messages'));
        expect(mockDbRun).toHaveBeenCalled();
    });
});
