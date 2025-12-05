import { GET } from '@/app/api/message-history/route';
import { NextRequest } from 'next/server';
import db from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn(),
}));

describe('Message History API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/message-history', () => {
        it('should return message history for a contact', async () => {
            const mockHistory = [
                {
                    id: 1,
                    template_id: 5,
                    template_name: 'Boas-vindas',
                    message_content: 'Olá João! Seja bem-vindo...',
                    sent_at: '2025-12-04T18:30:00.000Z',
                    status: 'sent'
                },
                {
                    id: 2,
                    template_id: 3,
                    template_name: 'Ajuda com Matrícula',
                    message_content: 'Olá João! Precisa de ajuda?',
                    sent_at: '2025-12-03T10:15:00.000Z',
                    status: 'sent'
                }
            ];

            (db.prepare as jest.Mock).mockReturnValue({
                all: jest.fn().mockReturnValue(mockHistory)
            });

            const req = new NextRequest('http://localhost/api/message-history?cpf=12345678901');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.history).toHaveLength(2);
            expect(data.history[0].template_name).toBe('Boas-vindas');
            expect(data.history[0].status).toBe('sent');
        });

        it('should return empty array for contact with no messages', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                all: jest.fn().mockReturnValue([])
            });

            const req = new NextRequest('http://localhost/api/message-history?cpf=99999999999');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.history).toEqual([]);
        });

        it('should return 400 if CPF is missing', async () => {
            const req = new NextRequest('http://localhost/api/message-history');
            const res = await GET(req);

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('CPF is required');
        });

        it('should order results by sent_at DESC', async () => {
            const mockHistory = [
                {
                    id: 2,
                    template_name: 'Second',
                    sent_at: '2025-12-04T18:30:00.000Z',
                    status: 'sent'
                },
                {
                    id: 1,
                    template_name: 'First',
                    sent_at: '2025-12-03T10:15:00.000Z',
                    status: 'sent'
                }
            ];

            (db.prepare as jest.Mock).mockReturnValue({
                all: jest.fn().mockReturnValue(mockHistory)
            });

            const req = new NextRequest('http://localhost/api/message-history?cpf=12345678901');
            await GET(req);

            // Verify the SQL query includes ORDER BY sent_at DESC
            const prepareCall = (db.prepare as jest.Mock).mock.calls[0][0];
            expect(prepareCall).toContain('ORDER BY sent_at DESC');
        });

        it('should include all required fields in response', async () => {
            const mockHistory = [
                {
                    id: 1,
                    template_id: 5,
                    template_name: 'Test Template',
                    message_content: 'Test message',
                    sent_at: '2025-12-04T18:30:00.000Z',
                    status: 'sent'
                }
            ];

            (db.prepare as jest.Mock).mockReturnValue({
                all: jest.fn().mockReturnValue(mockHistory)
            });

            const req = new NextRequest('http://localhost/api/message-history?cpf=12345678901');
            const res = await GET(req);
            const data = await res.json();

            const item = data.history[0];
            expect(item).toHaveProperty('id');
            expect(item).toHaveProperty('template_id');
            expect(item).toHaveProperty('template_name');
            expect(item).toHaveProperty('message_content');
            expect(item).toHaveProperty('sent_at');
            expect(item).toHaveProperty('status');
        });

        it('should handle failed messages in history', async () => {
            const mockHistory = [
                {
                    id: 1,
                    template_name: 'Failed Message',
                    message_content: 'This failed',
                    sent_at: '2025-12-04T18:30:00.000Z',
                    status: 'failed'
                }
            ];

            (db.prepare as jest.Mock).mockReturnValue({
                all: jest.fn().mockReturnValue(mockHistory)
            });

            const req = new NextRequest('http://localhost/api/message-history?cpf=12345678901');
            const res = await GET(req);
            const data = await res.json();

            expect(data.history[0].status).toBe('failed');
        });

        it('should handle database errors gracefully', async () => {
            (db.prepare as jest.Mock).mockImplementation(() => {
                throw new Error('Database error');
            });

            const req = new NextRequest('http://localhost/api/message-history?cpf=12345678901');
            const res = await GET(req);

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('Internal Server Error');
        });
    });
});
