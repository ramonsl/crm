import { GET as GET_CONTACTS } from '@/app/api/chat/contacts/route';
import { POST as POST_SEND } from '@/app/api/chat/send/route';
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';


// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

const mockPoolQuery = pool.query as jest.Mock;

// Mock WhatsApp
// Mock WhatsApp Provider Factory
jest.mock('@/lib/whatsapp/factory/WhatsAppProviderFactory', () => ({
    WhatsAppProviderFactory: {
        getProvider: jest.fn(),
    }
}));

import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';

describe('Chat Routes API', () => {
    let mockProvider: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockProvider = {
            isReady: jest.fn().mockResolvedValue(true),
            sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg_123' })
        };

        (WhatsAppProviderFactory.getProvider as jest.Mock).mockResolvedValue(mockProvider);
    });

    describe('GET /api/chat/contacts', () => {
        it('should return contacts list', async () => {
            const mockContacts = [
                {
                    cpf: '12345678901',
                    nome: 'Test',
                    telefone: '5511999999999',  // Valid phone number
                    last_message: 'Hello',
                    last_message_time: null,
                    last_message_direction: null,
                    unread_count: 0,
                    status: 'Novo',
                    tipo_ingresso: 'Vestibular',
                    profile_image: null
                }
            ];

            mockPoolQuery.mockResolvedValue({ rows: mockContacts, rowCount: 1 });

            const req = new NextRequest('http://localhost/api/chat/contacts');
            const res = await GET_CONTACTS(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.contacts).toHaveLength(1);
            expect(data.contacts[0].cpf).toBe('12345678901');
            expect(data.contacts[0].telefone).toBe('5511999999999');
        });
    });

    describe('POST /api/chat/send', () => {
        it('should send message successfully', async () => {
            // Mock DB to find contact
            mockPoolQuery.mockImplementation((queryStr: string) => {
                if (queryStr.includes('SELECT') && queryStr.includes('telefone')) {
                    return Promise.resolve({ rows: [{ telefone: '5511999999999' }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 1 }); // Insert message
            });

            // Mock WhatsApp success


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
            expect(mockProvider.sendMessage).toHaveBeenCalledWith('5511999999999', 'Hello World', undefined, undefined);
        });

        it('should return 404 if contact not found', async () => {
            mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

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
