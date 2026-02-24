import { POST } from '@/app/api/forward/route';
import { pool } from '@/lib/db';

import { NextRequest } from 'next/server';
import { IWhatsAppProvider } from '@/lib/whatsapp/IWhatsAppProvider';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
}));

// Mock WhatsApp
// Mock WhatsApp Provider Factory
jest.mock('@/lib/whatsapp/factory/WhatsAppProviderFactory', () => ({
    WhatsAppProviderFactory: {
        getProvider: jest.fn(),
    }
}));

import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';

// Mock Auth
jest.mock('@/lib/auth/requireAuth', () => ({
    requireAuth: jest.fn().mockResolvedValue({ id: 1, email: 'test@test.com', role: 'user' }),
    UnauthorizedError: class UnauthorizedError extends Error { },
}));

const mockPoolQuery = pool.query as jest.Mock;


function createRequest(method: string, url: string, body?: unknown) {
    return new NextRequest(new URL(url, 'http://localhost'), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
}

describe('/api/forward', () => {
    let mockProvider: jest.Mocked<IWhatsAppProvider>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockProvider = {
            initialize: jest.fn(),
            restart: jest.fn(),
            logout: jest.fn(),
            clearSession: jest.fn(),
            getStatus: jest.fn().mockResolvedValue({ status: 'ready' }),
            isReady: jest.fn().mockResolvedValue(true),
            sendTextMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg_123' }),
            sendImage: jest.fn(),
            sendVideo: jest.fn(),
            sendAudio: jest.fn(),
            sendDocument: jest.fn(),
            sendMessage: jest.fn(),
            getProfilePicture: jest.fn(),
            getContactInfo: jest.fn(),
            validateNumber: jest.fn(),
            onMessage: jest.fn(),
            onStatusChange: jest.fn(),
            offMessage: jest.fn(),
            offStatusChange: jest.fn(),
            getProviderName: jest.fn().mockReturnValue('Mock'),
            getProviderVersion: jest.fn().mockReturnValue('1.0.0'),
            listGroups: jest.fn(),
            getGroupParticipants: jest.fn(),
            isNumberInGroup: jest.fn(),
            onLog: jest.fn(),
            offLog: jest.fn(),
            syncChatHistory: jest.fn(),
            onHistorySync: jest.fn(),
            offHistorySync: jest.fn(),
        };

        (WhatsAppProviderFactory.getProvider as jest.Mock).mockResolvedValue(mockProvider);
    });

    it('should forward lead successfully', async () => {
        // 1. Find lead (CPF)
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ cpf: '123', nome: 'Test Lead', telefone: '5511999999999', status: 'NOVO' }],
            rowCount: 1
        });

        // 2. getStatus called (mocked to ready)
        mockProvider.getStatus.mockResolvedValue({ status: 'ready' });

        // 3. fetch messages
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        // 4. fetch OpenAI settings
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        // 5. sendMessage happens here (no DB call)

        // 6. logForwarded (INSERT)
        // ActivityRepository expects a return value
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

        // 7. Check tag "Comercial"
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

        // 8. Insert lead_tag
        mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

        const body = { cpf: '123', comercialPhone: '5551987654321', comercialName: 'Sales' };
        const req = createRequest('POST', '/api/forward', body);
        const res = await POST(req);

        if (res.status === 500) {
            const calls = (console.error as jest.Mock).mock.calls;
            process.stdout.write('Detailed 500 Error Calls:\n');
            calls.forEach((args: unknown[]) => {
                args.forEach(arg => {
                    if (arg instanceof Error) {
                        process.stdout.write(`Error: ${arg.message}\nStack: ${arg.stack}\n`);
                    } else {
                        process.stdout.write(`Arg: ${JSON.stringify(arg, null, 2)}\n`);
                    }
                });
            });
        }

        expect(res.status).toBe(200);
        expect(res.status).toBe(200);
        expect(mockProvider.sendTextMessage).toHaveBeenCalledWith('5551987654321', expect.stringContaining('Novo Lead'));
        expect(mockProvider.getStatus).toHaveBeenCalled();
    });

    it('should return error if WhatsApp not ready', async () => {
        // 1. Find lead
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ cpf: '123', nome: 'Test Lead', telefone: '5511999999999' }],
            rowCount: 1
        });

        mockProvider.getStatus.mockResolvedValue({ status: 'disconnected' });

        const body = { cpf: '123', comercialPhone: '5551987654321' };
        const req = createRequest('POST', '/api/forward', body);
        const res = await POST(req);

        expect(res.status).toBe(400);
    });

    it('should return 404 if lead not found', async () => {
        // Mock pool.query to always return empty rows for this test
        // This covers both CPF search and Phone fallback search
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

        const body = { cpf: '999', comercialPhone: '5551987654321' };
        const req = createRequest('POST', '/api/forward', body);
        const res = await POST(req);

        expect(res.status).toBe(404);
    });
});
