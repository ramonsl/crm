import { GET } from '@/app/api/message-history/route';
import { NextRequest } from 'next/server';
import { TemplateHistoryService } from '@/services/templateHistoryService';

// Mock service
jest.mock('@/services/templateHistoryService');
jest.mock('@/lib/db', () => ({
    pool: { query: jest.fn() }
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
                    phone: '51999887766',
                    template_name: 'Boas-vindas',
                    template_content: 'Olá!',
                    sent_at: '2025-12-06T10:00:00Z',
                    success: true,
                    error_message: null
                },
                {
                    id: 2,
                    phone: '51999887766',
                    template_name: 'Follow-up',
                    template_content: 'Como vai?',
                    sent_at: '2025-12-06T11:00:00Z',
                    success: true,
                    error_message: null
                }
            ];

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: jest.fn().mockResolvedValue(mockHistory)
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.messages).toHaveLength(2);
            expect(data.messages[0].template_name).toBe('Boas-vindas');
            expect(data.messages[0].status).toBe('delivered');
        });

        it('should return empty array for contact with no messages', async () => {
            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: jest.fn().mockResolvedValue([])
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.messages).toEqual([]);
        });

        it('should return 400 if phone is missing', async () => {
            const req = new NextRequest('http://localhost/api/message-history');
            const res = await GET(req);

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('Phone number is required');
        });

        it('should include all required fields in response', async () => {
            const mockHistory = [
                {
                    id: 1,
                    phone: '51999887766',
                    template_name: 'Test Template',
                    template_content: 'Test message',
                    sent_at: '2025-12-06T10:00:00Z',
                    success: true,
                    error_message: null
                }
            ];

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: jest.fn().mockResolvedValue(mockHistory)
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);
            const data = await res.json();

            const item = data.messages[0];
            expect(item).toHaveProperty('id');
            expect(item).toHaveProperty('template_name');
            expect(item).toHaveProperty('message');
            expect(item).toHaveProperty('timestamp');
            expect(item).toHaveProperty('status');
        });

        it('should handle failed messages in history', async () => {
            const mockHistory = [
                {
                    id: 1,
                    phone: '51999887766',
                    template_name: 'Failed Message',
                    template_content: 'This failed',
                    sent_at: '2025-12-06T10:00:00Z',
                    success: false,
                    error_message: 'Send failed'
                }
            ];

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: jest.fn().mockResolvedValue(mockHistory)
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);
            const data = await res.json();

            expect(data.messages[0].status).toBe('failed');
        });

        it('should handle database errors gracefully', async () => {
            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: jest.fn().mockRejectedValue(new Error('Database error'))
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('Database error');
        });
    });
});
