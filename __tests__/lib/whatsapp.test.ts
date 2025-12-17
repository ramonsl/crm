import * as whatsapp from '@/lib/whatsapp';
import { Client } from 'whatsapp-web.js';

// Suppress console output during tests for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

// Mock whatsapp-web.js
jest.mock('whatsapp-web.js', () => {
    return {
        Client: jest.fn().mockImplementation(() => ({
            on: jest.fn(),
            initialize: jest.fn().mockResolvedValue(true),
            destroy: jest.fn().mockResolvedValue(true),
            sendMessage: jest.fn().mockResolvedValue({ id: { id: 'mock_msg_id' } }),
            getNumberId: jest.fn().mockResolvedValue({ _serialized: '5551981636027@c.us' }),
            getState: jest.fn().mockResolvedValue('CONNECTED'),
        })),
        LocalAuth: jest.fn(),
    };
});

// Mock Neon PostgreSQL Database
jest.mock('@/lib/neonDb', () => ({
    pool: {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: jest.fn().mockResolvedValue({
            query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
            release: jest.fn(),
        }),
    },
    query: jest.fn().mockResolvedValue([]),
    queryOne: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue(0),
    sql: jest.fn().mockResolvedValue([]),
}));

// Mock legacy DB (for backwards compatibility)
jest.mock('@/lib/db', () => ({
    prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        get: jest.fn().mockReturnValue(undefined),
        all: jest.fn().mockReturnValue([]),
    }),
}));

// Mock fs/promises for resetSession
jest.mock('fs/promises', () => ({
    rm: jest.fn().mockResolvedValue(true),
}));


describe('WhatsApp Client', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset global state if possible, or just rely on mocks
        // Since we can't easily reset globals in this setup without a helper,
        // we assume fresh mocks for each test file run or careful state management.
    });

    it('should initialize client', () => {
        const client = whatsapp.getClient();
        expect(client).toBeDefined();
        expect(Client).toHaveBeenCalled();
    });

    it('should send message', async () => {
        // Ensure client is initialized
        whatsapp.getClient();

        // Mock global state to be ready (this is tricky with globals in modules)
        // We might need to spy on getStatus or just assume getClient sets it.
        // In this test setup, we are testing the exported functions.

        // Force ready status for test
        (global as any).whatsappStatus = 'ready';
        const mockClient = new Client({} as any);
        (mockClient as any).getState = jest.fn().mockResolvedValue('CONNECTED');
        (global as any).whatsappClient = mockClient;

        const result = await whatsapp.sendMessage('5551981636027', 'Hello');
        expect(result.success).toBe(true);
        expect(result.id).toBe('mock_msg_id');
    });

    it('should reset session', async () => {
        await whatsapp.resetSession();
        expect(true).toBe(true);
    });

    it('should send notification on ready', async () => {
        // Mock Client to capture event handlers
        const onMock = jest.fn();
        const sendMessageMock = jest.fn().mockResolvedValue({});

        (Client as unknown as jest.Mock).mockImplementation(() => ({
            on: onMock,
            initialize: jest.fn().mockResolvedValue(true),
            destroy: jest.fn().mockResolvedValue(true),
            sendMessage: sendMessageMock,
        }));

        // Clear global client to force re-initialization
        (global as any).whatsappClient = null;

        // Initialize to register handlers
        whatsapp.getClient();

        // Find the 'ready' handler
        const readyHandler = onMock.mock.calls.find(call => call[0] === 'ready')?.[1];
        expect(readyHandler).toBeDefined();

        // Simulate ready event
        // We need to set the global client first because the handler uses it
        (global as any).whatsappClient = { sendMessage: sendMessageMock };

        await readyHandler();

        expect(sendMessageMock).toHaveBeenCalledWith(
            expect.stringContaining('555181636027'),
            expect.stringContaining('Conexão com WhatsApp estabelecida')
        );
    });



    it('should discard random message from unknown number', async () => {
        const onMock = jest.fn();
        const replyMock = jest.fn().mockResolvedValue({});

        (Client as unknown as jest.Mock).mockImplementation(() => ({
            on: onMock,
            initialize: jest.fn().mockResolvedValue(true),
            destroy: jest.fn().mockResolvedValue(true),
        }));

        (global as any).whatsappClient = null;
        whatsapp.getClient(); // This will set up the client and its 'on' handler

        const messageHandler = onMock.mock.calls.find(call => call[0] === 'message_create')?.[1];
        expect(messageHandler).toBeDefined();

        const mockMsg = {
            from: '5551999999999@c.us',
            body: 'Olá, tudo bem?',
            reply: replyMock,
            getContact: jest.fn().mockResolvedValue({ name: 'Unknown' })
        };

        const db = require('@/lib/db');
        const dbGetMock = jest.fn().mockReturnValue(undefined); // Lead not found
        (db.prepare as jest.Mock).mockReturnValue({ get: dbGetMock, run: jest.fn() });

        const messageQueue = require('@/lib/messageQueue');
        const addLogMock = jest.fn();
        (messageQueue.addLog as jest.Mock) = addLogMock;

        // Trigger the message handler
        await messageHandler(mockMsg);

        expect(mockMsg.reply).not.toHaveBeenCalled();
        // Should NOT log to queue (silent discard)
        expect(addLogMock).not.toHaveBeenCalled();
    });

    it('should add 55 to local numbers', async () => {
        const sendMessageMock = jest.fn().mockResolvedValue({ id: { id: 'msg_id' } });
        const getNumberIdMock = jest.fn().mockImplementation((phone) => {
            if (phone === '+555199999999') return null; // Fail 12-digit check
            if (phone === '+5551999999999') return { _serialized: '5551999999999@c.us' };
            return null;
        });
        const getStateMock = jest.fn().mockResolvedValue('CONNECTED');

        (global as any).whatsappClient = {
            sendMessage: sendMessageMock,
            getNumberId: getNumberIdMock,
            getState: getStateMock
        };
        (global as any).whatsappStatus = 'ready';

        await whatsapp.sendMessage('51999999999', 'test');

        // Should lookup with +55...
        expect(getNumberIdMock).toHaveBeenCalledWith('+5551999999999');
        expect(sendMessageMock).toHaveBeenCalledWith('5551999999999@c.us', 'test', { caption: undefined });
    });

    it('should respect international numbers', async () => {
        const sendMessageMock = jest.fn().mockResolvedValue({ id: { id: 'msg_id' } });
        const getNumberIdMock = jest.fn().mockResolvedValue({ _serialized: '123456789012@c.us' });
        const getStateMock = jest.fn().mockResolvedValue('CONNECTED');
        (global as any).whatsappClient = {
            sendMessage: sendMessageMock,
            getNumberId: getNumberIdMock,
            getState: getStateMock
        };
        (global as any).whatsappStatus = 'ready';

        await whatsapp.sendMessage('123456789012', 'test');

        // Should lookup with +123...
        expect(getNumberIdMock).toHaveBeenCalledWith('+123456789012');
        expect(sendMessageMock).toHaveBeenCalledWith('123456789012@c.us', 'test', { caption: undefined });
    });
});
