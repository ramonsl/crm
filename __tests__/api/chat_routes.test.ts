import { GET as GET_CONTACTS } from '@/app/api/chat/contacts/route';
import { POST as POST_SEND } from '@/app/api/chat/send/route';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { sendMessage } from '@/lib/whatsapp';

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn()
}));

// Mock WhatsApp
jest.mock('@/lib/whatsapp', () => ({
    sendMessage: jest.fn()
}));

describe('Chat Routes API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/chat/contacts', () => {
        it('should return contacts list', async () => {
            const mockContacts = [
                { cpf: '123', nome: 'Test', last_message: 'Hello' }
            ];

            (db.prepare as jest.Mock).mockReturnValue({
                all: jest.fn().mockReturnValue(mockContacts)
            });

            const req = new NextRequest('http://localhost/api/chat/contacts');
            const res = await GET_CONTACTS(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.contacts).toHaveLength(1);
            expect(data.contacts[0].cpf).toBe('123');
        });
    });

    describe('POST /api/chat/send', () => {
        it('should send message successfully', async () => {
            // Mock DB to find contact
            (db.prepare as jest.Mock).mockImplementation((query) => {
                if (query.includes('SELECT telefone')) {
                    return { get: jest.fn().mockReturnValue({ telefone: '5511999999999' }) };
                }
                return { run: jest.fn() }; // Insert message
            });

            // Mock WhatsApp success
            (sendMessage as jest.Mock).mockResolvedValue({ id: 'msg_123' });

            const req = new NextRequest('http://localhost/api/chat/send', {
                method: 'POST',
                body: JSON.stringify({
                    cpf: '12345678901',
                    message: 'Hello World'
                })
            });

            const res = await POST_SEND(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.messageId).toBe('msg_123');
            expect(sendMessage).toHaveBeenCalledWith('5511999999999', 'Hello World', undefined, undefined);
        });

        it('should return 404 if contact not found', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                get: jest.fn().mockReturnValue(undefined)
            });

            const req = new NextRequest('http://localhost/api/chat/send', {
                method: 'POST',
                body: JSON.stringify({
                    cpf: '999',
                    message: 'Hello'
                })
            });

            const res = await POST_SEND(req);
            expect(res.status).toBe(404);
        });

        it('should return 400 if missing fields', async () => {
            const req = new NextRequest('http://localhost/api/chat/send', {
                method: 'POST',
                body: JSON.stringify({
                    cpf: '123'
                })
            });

            const res = await POST_SEND(req);
            expect(res.status).toBe(400);
        });
    });
});
