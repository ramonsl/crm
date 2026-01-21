/**
 * Template History API Tests
 * Tests for POST /api/template-history and GET /api/message-history
 */

import { POST } from '@/app/api/template-history/route';
import { GET } from '@/app/api/message-history/route';
import { NextRequest } from 'next/server';
import { TemplateHistoryService } from '@/services/templateHistoryService';

// Mock dependencies
jest.mock('@/repositories/templateHistoryRepository');
jest.mock('@/services/templateHistoryService');
jest.mock('@/lib/db', () => ({
    pool: { query: jest.fn() }
}));

describe('Template History API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/template-history', () => {
        it('should record template sent successfully', async () => {
            const mockRecordTemplateSent = jest.fn().mockResolvedValue(undefined);

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                recordTemplateSent: mockRecordTemplateSent
            }));

            const req = new NextRequest('http://localhost/api/template-history', {
                method: 'POST',
                body: JSON.stringify({
                    phone: '51999887766',
                    templateName: 'Boas-vindas',
                    templateContent: 'Olá!',
                    success: true
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockRecordTemplateSent).toHaveBeenCalledWith({
                phone: '51999887766',
                templateName: 'Boas-vindas',
                templateContent: 'Olá!',
                success: true,
                errorMessage: undefined
            });
        });

        it('should reject missing phone', async () => {
            const req = new NextRequest('http://localhost/api/template-history', {
                method: 'POST',
                body: JSON.stringify({
                    templateName: 'Test'
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Phone and template name are required');
        });

        it('should reject missing template name', async () => {
            const req = new NextRequest('http://localhost/api/template-history', {
                method: 'POST',
                body: JSON.stringify({
                    phone: '51999887766'
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Phone and template name are required');
        });

        it('should handle service errors', async () => {
            const mockRecordTemplateSent = jest.fn().mockRejectedValue(
                new Error('Database error')
            );

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                recordTemplateSent: mockRecordTemplateSent
            }));

            const req = new NextRequest('http://localhost/api/template-history', {
                method: 'POST',
                body: JSON.stringify({
                    phone: '51999887766',
                    templateName: 'Test',
                    templateContent: 'Content',
                    success: true
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe('Database error');
        });

        it('should default success to true if not provided', async () => {
            const mockRecordTemplateSent = jest.fn().mockResolvedValue(undefined);

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                recordTemplateSent: mockRecordTemplateSent
            }));

            const req = new NextRequest('http://localhost/api/template-history', {
                method: 'POST',
                body: JSON.stringify({
                    phone: '51999887766',
                    templateName: 'Test',
                    templateContent: 'Content'
                })
            });

            await POST(req);

            expect(mockRecordTemplateSent).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true
                })
            );
        });
    });

    describe('GET /api/message-history', () => {
        it('should return history by phone', async () => {
            const mockHistory = [
                {
                    id: 1,
                    phone: '51999887766',
                    template_name: 'Boas-vindas',
                    template_content: 'Olá, bem-vindo!',
                    sent_at: '2025-12-06T10:00:00Z',
                    success: true,
                    error_message: null
                },
                {
                    id: 2,
                    phone: '51999887766',
                    template_name: 'Follow-up',
                    template_content: 'Como posso ajudar?',
                    sent_at: '2025-12-06T11:00:00Z',
                    success: true,
                    error_message: null
                }
            ];

            const mockGetPhoneHistory = jest.fn().mockResolvedValue(mockHistory);

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: mockGetPhoneHistory
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.messages).toHaveLength(2);
            expect(data.total).toBe(2);
            expect(data.messages[0].template_name).toBe('Boas-vindas');
            expect(data.messages[0].status).toBe('delivered');
            expect(data.messages[1].template_name).toBe('Follow-up');
        });

        it('should return empty array if no history', async () => {
            const mockGetPhoneHistory = jest.fn().mockResolvedValue([]);

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: mockGetPhoneHistory
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.messages).toHaveLength(0);
            expect(data.total).toBe(0);
        });

        it('should accept cpf parameter for backward compatibility', async () => {
            const mockGetPhoneHistory = jest.fn().mockResolvedValue([]);

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: mockGetPhoneHistory
            }));

            const req = new NextRequest('http://localhost/api/message-history?cpf=12345678901');
            const res = await GET(req);

            expect(res.status).toBe(200);
            expect(mockGetPhoneHistory).toHaveBeenCalledWith('12345678901');
        });

        it('should reject missing phone parameter', async () => {
            const req = new NextRequest('http://localhost/api/message-history');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Phone number is required');
        });

        it('should handle service errors', async () => {
            const mockGetPhoneHistory = jest.fn().mockRejectedValue(
                new Error('Database connection failed')
            );

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: mockGetPhoneHistory
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe('Database connection failed');
        });

        it('should mark failed messages with failed status', async () => {
            const mockHistory = [
                {
                    id: 1,
                    phone: '51999887766',
                    template_name: 'Test',
                    template_content: 'Content',
                    sent_at: '2025-12-06T10:00:00Z',
                    success: false,
                    error_message: 'Send failed'
                }
            ];

            const mockGetPhoneHistory = jest.fn().mockResolvedValue(mockHistory);

            (TemplateHistoryService as jest.Mock).mockImplementation(() => ({
                getPhoneHistory: mockGetPhoneHistory
            }));

            const req = new NextRequest('http://localhost/api/message-history?phone=51999887766');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.messages[0].status).toBe('failed');
        });
    });
});
