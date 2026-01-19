
import { BaileysMessageHandler } from '@/services/BaileysMessageHandler';
import { pool } from '@/lib/db';
import { emitNewMessage, emitNewMessageToPhone, emitContactUpdated } from '@/lib/socket/emitter';

// Mock dependencies
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

jest.mock('@/lib/socket/emitter', () => ({
    emitNewMessage: jest.fn(),
    emitNewMessageToPhone: jest.fn(),
    emitContactUpdated: jest.fn()
}));

jest.mock('@/lib/logger', () => ({
    whatsappLogger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock('@/lib/messageQueue', () => ({
    messageQueue: {
        addLog: jest.fn()
    }
}));

describe('BaileysMessageHandler', () => {
    let handler: BaileysMessageHandler;

    beforeEach(() => {
        handler = new BaileysMessageHandler();
        jest.clearAllMocks();
    });

    it('should handle incoming message for existing contact', async () => {
        const msg = {
            from: '5511999999999',
            body: 'Hello World',
            isGroup: false,
            timestamp: new Date(),
            fromMe: false,
            id: 'MSG-123'
        };

        // Mock findContact to return existing contact
        (pool.query as jest.Mock).mockResolvedValueOnce({
            rows: [{ cpf: '12345678900', nome: 'Test User', telefone: '5511999999999' }]
        });

        // Mock saveMessage INSERT
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update Last Message
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'MSG-123' }] }); // Insert Message

        await handler.handle(msg);

        // Verify contact lookup
        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT cpf, nome, telefone FROM leads'), expect.anything());

        // Verify update last message
        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE leads'), expect.arrayContaining(['Hello World']));

        // Verify message saved
        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO messages'), expect.arrayContaining(['MSG-123', 'Hello World']));

        // Verify socket events
        expect(emitNewMessage).toHaveBeenCalled();
        expect(emitNewMessageToPhone).toHaveBeenCalled();
        expect(emitContactUpdated).toHaveBeenCalled();
    });

    it('should create new lead for unknown contact', async () => {
        const msg = {
            from: '5511888888888',
            body: 'New User Here',
            isGroup: false,
            timestamp: new Date(),
            fromMe: false,
            id: 'MSG-456'
        };

        // Mock findContact (first main query empty, fallback empty)
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        // Mock insert lead
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        // Mock update last message
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        // Mock insert message
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });


        await handler.handle(msg);

        // Verify lead creation
        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO leads'), expect.arrayContaining(['5511888888888']));
    });
});
