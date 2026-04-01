
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

jest.mock('@/lib/utils/phoneUtils', () => ({
    getPhoneVariations: jest.fn().mockReturnValue(['5511999999999']),
}));

jest.mock('@/lib/repositories/SettingRepository', () => ({
    SettingRepository: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue('5511999999999'),
    })),
}));

jest.mock('@/services/whatsAppGroupService', () => ({
    whatsAppGroupService: { sendToGroupById: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/services/WhatsAppChatService', () => ({
    whatsAppChatService: { sendTextMessage: jest.fn().mockResolvedValue(undefined) },
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
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'MSG-123' }], rowCount: 1 }); // Insert Message

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

// ── DI-based routing tests ────────────────────────────────────────────────────

describe('BaileysMessageHandler (DI routing)', () => {
    const mockOrchestration = {
        isSyncing: false,
        syncLogs: [] as string[],
        state: { isSyncing: false, logs: [] as string[], getState: jest.fn() },
        runSync: jest.fn().mockResolvedValue({ posted: 2, skipped: 0, errors: 0, processed: 2 }),
        resendErrors: jest.fn(),
    };

    const mockDirectIntake = {
        processDirectJobMessage: jest.fn().mockResolvedValue(false),
    };

    function makeHandler() {
        return new BaileysMessageHandler(mockOrchestration as never, mockDirectIntake as never);
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('ignores unrecognized group messages (not a job command)', async () => {
        const handler = makeHandler();
        await handler.handle({
            id: 'g1', from: 'group@g.us', body: 'Bom dia galera!',
            fromMe: false, isGroup: true, timestamp: new Date(),
        } as never);

        expect(mockOrchestration.runSync).not.toHaveBeenCalled();
        expect(mockDirectIntake.processDirectJobMessage).not.toHaveBeenCalled();
    });

    it('does not call runSync when group does not match configured group', async () => {
        // SettingRepository mock returns 'configured-group' but message is from a different group
        (jest.requireMock('@/lib/repositories/SettingRepository').SettingRepository as jest.Mock)
            .mockImplementationOnce(() => ({ get: jest.fn().mockResolvedValue('other-group@g.us') }));

        const handler = makeHandler();
        await handler.handle({
            id: 'g2', from: 'wrong-group@g.us', body: 'vagas',
            fromMe: false, isGroup: true, timestamp: new Date(),
        } as never);

        await new Promise(process.nextTick);
        expect(mockOrchestration.runSync).not.toHaveBeenCalled();
    });

    it('applies debounce — second identical command within 60s is ignored', async () => {
        const handler = makeHandler();
        const baseMsg = {
            from: '5511999999999', body: 'vagas',
            fromMe: false, isGroup: true, timestamp: new Date(),
        };

        await handler.handle({ ...baseMsg, id: 'deb-1' } as never);
        await handler.handle({ ...baseMsg, id: 'deb-2' } as never);
        await new Promise(process.nextTick);

        expect(mockOrchestration.runSync).toHaveBeenCalledTimes(1);
    });

    it('skips duplicate messages (same id processed twice)', async () => {
        const handler = makeHandler();
        // from must contain the configured group id ('5511999999999') so the group check passes
        const msg = {
            id: 'dup-99', from: '5511999999999@g.us', body: 'vagas',
            fromMe: false, isGroup: true, timestamp: new Date(),
        } as never;

        await handler.handle(msg);
        await handler.handle(msg); // same id — second call is deduplicated in memory
        await new Promise(process.nextTick);

        expect(mockOrchestration.runSync).toHaveBeenCalledTimes(1);
    });
});

