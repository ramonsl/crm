import { GET as GET_STATUS, POST as POST_ACTION, DELETE as DELETE_SESSION } from '@/app/api/whatsapp/route';
import { POST as POST_QUEUE, GET as GET_QUEUE, DELETE as DELETE_QUEUE } from '@/app/api/whatsapp/queue/route';
import { GET as GET_VALIDATE } from '@/app/api/whatsapp/validate/route';
import { NextRequest } from 'next/server';
import { getStatus, getClient, logout, sendMessage, validateWhatsAppNumber } from '@/lib/whatsapp';
import { messageQueue } from '@/lib/messageQueue';
import db from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/whatsapp', () => ({
    getStatus: jest.fn(),
    getClient: jest.fn(),
    logout: jest.fn(),
    sendMessage: jest.fn(),
    validateWhatsAppNumber: jest.fn(),
    resetSession: jest.fn()
}));

jest.mock('@/lib/messageQueue', () => ({
    messageQueue: {
        enqueue: jest.fn(),
        getState: jest.fn(),
        clear: jest.fn()
    }
}));

jest.mock('@/lib/db', () => ({
    prepare: jest.fn()
}));

describe('WhatsApp API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Main Route (/api/whatsapp)', () => {
        it('GET should return status', async () => {
            (getStatus as jest.Mock).mockReturnValue({ status: 'connected' });
            const res = await GET_STATUS();
            const data = await res.json();
            expect(data.status).toBe('connected');
        });

        it('POST connect should trigger getClient', async () => {
            const req = new NextRequest('http://localhost/api/whatsapp', {
                method: 'POST',
                body: JSON.stringify({ action: 'connect' })
            });
            await POST_ACTION(req);
            expect(getClient).toHaveBeenCalled();
        });

        it('POST send should send message', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                get: jest.fn().mockReturnValue({ nome: 'Test User' })
            });
            (sendMessage as jest.Mock).mockResolvedValue({ id: '123' });

            const req = new NextRequest('http://localhost/api/whatsapp', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'send',
                    phone: '5511999999999',
                    message: 'Hello {nome}'
                })
            });

            const res = await POST_ACTION(req);
            const data = await res.json();

            expect(data.success).toBe(true);
            // A API extrai apenas o primeiro nome, então "Test User" vira "Test"
            expect(sendMessage).toHaveBeenCalledWith('5511999999999', 'Hello Test');
        });

        it('POST disconnect should call logout', async () => {
            const req = new NextRequest('http://localhost/api/whatsapp', {
                method: 'POST',
                body: JSON.stringify({ action: 'disconnect' })
            });
            await POST_ACTION(req);
            expect(logout).toHaveBeenCalled();
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
            (validateWhatsAppNumber as jest.Mock).mockResolvedValue('123@c.us');

            const req = new NextRequest('http://localhost/api/whatsapp/validate?phone=123');
            const res = await GET_VALIDATE(req);
            const data = await res.json();

            expect(data.valid).toBe(true);
            expect(data.chatId).toBe('123@c.us');
        });

        it('GET should return invalid if not found', async () => {
            (validateWhatsAppNumber as jest.Mock).mockResolvedValue(null);

            const req = new NextRequest('http://localhost/api/whatsapp/validate?phone=123');
            const res = await GET_VALIDATE(req);
            const data = await res.json();

            expect(data.valid).toBe(false);
        });
    });
});
