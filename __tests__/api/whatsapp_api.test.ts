import { GET as GET_STATUS, POST as POST_ACTION } from '@/app/api/whatsapp/route';
import { POST as POST_QUEUE, GET as GET_QUEUE, DELETE as DELETE_QUEUE } from '@/app/api/whatsapp/queue/route';
import { GET as GET_VALIDATE } from '@/app/api/whatsapp/validate/route';
import { NextRequest } from 'next/server';
import { messageQueue } from '@/lib/messageQueue';
import { pool } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/whatsapp/factory/WhatsAppProviderFactory', () => ({
    WhatsAppProviderFactory: {
        getProvider: jest.fn(),
        hasProvider: jest.fn(),
        getCurrentProviderType: jest.fn(),
        persistProvider: jest.fn()
    }
}));

jest.mock('@/lib/whatsapp/manager/WhatsAppProviderManager', () => ({
    WhatsAppProviderManager: {
        getInstance: jest.fn()
    }
}));

import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';
import { WhatsAppProviderManager } from '@/lib/whatsapp/manager/WhatsAppProviderManager';
import { IWhatsAppProvider } from '@/lib/whatsapp/IWhatsAppProvider';

jest.mock('@/lib/messageQueue', () => ({
    messageQueue: {
        enqueue: jest.fn(),
        getState: jest.fn(),
        clear: jest.fn()
    }
}));

jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

// Mock Auth
jest.mock('@/lib/auth/requireAuth', () => ({
    requireAuth: jest.fn().mockResolvedValue({ id: 1, email: 'test@test.com', role: 'user' }),
    UnauthorizedError: class UnauthorizedError extends Error { },
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('WhatsApp API', () => {
    let mockProvider: jest.Mocked<IWhatsAppProvider>;
    let mockManager: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock provider
        mockProvider = {
            getStatus: jest.fn().mockResolvedValue({ status: 'connected' }),
            initialize: jest.fn(),
            logout: jest.fn(),
            sendTextMessage: jest.fn().mockResolvedValue({ id: '123', success: true }),
            validateNumber: jest.fn().mockResolvedValue('5511999999999@s.whatsapp.net'),
            isReady: jest.fn().mockResolvedValue(true),
            sendImage: jest.fn(),
            sendVideo: jest.fn(),
            sendAudio: jest.fn(),
            sendDocument: jest.fn(),
            sendMessage: jest.fn(),
            getProfilePicture: jest.fn(),
            getContactInfo: jest.fn(),
            onMessage: jest.fn(),
            onStatusChange: jest.fn(),
            restart: jest.fn(),
            clearSession: jest.fn()
        } as unknown as jest.Mocked<IWhatsAppProvider>;

        // Setup Factory mock
        (WhatsAppProviderFactory.getProvider as jest.Mock).mockResolvedValue(mockProvider);
        (WhatsAppProviderFactory.hasProvider as jest.Mock).mockReturnValue(true);

        // Setup Manager mock
        mockManager = {
            getOfficialProvider: jest.fn().mockReturnValue(mockProvider),
            getWebProvider: jest.fn().mockResolvedValue(mockProvider), // Web provider is async in route
        };
        (WhatsAppProviderManager.getInstance as jest.Mock).mockReturnValue(mockManager);
    });

    describe('Main Route (/api/whatsapp)', () => {
        it('GET should return status from Manager', async () => {
            const req = new NextRequest('http://localhost/api/whatsapp');
            const res = await GET_STATUS(req);
            const data = await res.json();

            // Manager should be called
            expect(WhatsAppProviderManager.getInstance).toHaveBeenCalled();
            expect(mockManager.getOfficialProvider).toHaveBeenCalled();
            expect(mockManager.getWebProvider).toHaveBeenCalled();

            // Check composite status from new implementation
            // The route returns { official: ..., web: ..., status: ... }
            expect(data.web.status).toBe('connected');
            // Legacy field 'status' should be populated generally based on web
            expect(data.status).toBe('connected');
        });

        it('POST connect should trigger initialize', async () => {
            const req = new NextRequest('http://localhost/api/whatsapp', {
                method: 'POST',
                body: JSON.stringify({ action: 'connect' })
            });

            await POST_ACTION(req);

            expect(WhatsAppProviderFactory.getProvider).toHaveBeenCalled();
            expect(mockProvider.initialize).toHaveBeenCalled();
        });

        it('POST send should send message', async () => {
            mockPoolQuery.mockResolvedValue({
                rows: [{ nome: 'Test User' }],
                rowCount: 1
            });

            mockProvider.getStatus.mockResolvedValue({ status: 'ready' });

            const req = new NextRequest('http://localhost/api/whatsapp', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'send',
                    phone: '5511999999999',
                    message: 'Hello {nome}',
                    provider: 'baileys'
                })
            });

            const res = await POST_ACTION(req);
            const data = await res.json();

            expect(data.success).toBe(true);
            // Verifica se o texto foi interpolado
            expect(mockProvider.sendTextMessage).toHaveBeenCalledWith('5511999999999', 'Hello Test');
        });

        it('POST disconnect should call logout', async () => {
            const req = new NextRequest('http://localhost/api/whatsapp', {
                method: 'POST',
                body: JSON.stringify({ action: 'disconnect' })
            });
            await POST_ACTION(req);
            expect(mockProvider.logout).toHaveBeenCalled();
        });
    });

    describe('Queue Route (/api/whatsapp/queue)', () => {
        it('POST should enqueue messages', async () => {
            const req = new NextRequest('http://localhost/api/whatsapp/queue', {
                method: 'POST',
                body: JSON.stringify({
                    messages: [{ phone: '123', message: 'test' }]
                })
            });

            const res = await POST_QUEUE(req);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(messageQueue.enqueue).toHaveBeenCalled();
        });

        it('GET should return queue state', async () => {
            (messageQueue.getState as jest.Mock).mockReturnValue({ queue: [], processing: false });
            const res = await GET_QUEUE();
            const data = await res.json();
            expect(data.processing).toBe(false);
        });

        it('DELETE should clear queue', async () => {
            const res = await DELETE_QUEUE();
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(messageQueue.clear).toHaveBeenCalled();
        });
    });

    describe('Validate Route (/api/whatsapp/validate)', () => {
        it('GET should validate number', async () => {
            mockProvider.validateNumber.mockResolvedValue('5551999999999@s.whatsapp.net');

            const req = new NextRequest('http://localhost/api/whatsapp/validate?phone=123');
            const res = await GET_VALIDATE(req);
            const data = await res.json();

            expect(data.valid).toBe(true);
            expect(data.chatId).toBe('5551999999999@s.whatsapp.net');
        });

        it('GET should return invalid if not found', async () => {
            mockProvider.validateNumber.mockResolvedValue(null);

            const req = new NextRequest('http://localhost/api/whatsapp/validate?phone=123');
            const res = await GET_VALIDATE(req);
            const data = await res.json();

            expect(data.valid).toBe(false);
        });
    });
});
