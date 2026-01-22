import { GET as GET_DASHBOARD } from '@/app/api/dashboard/route';
import { GET as GET_SETTINGS, POST as POST_SETTINGS } from '@/app/api/settings/route';
import { GET as GET_TEMPLATES, POST as POST_TEMPLATES, PUT as PUT_TEMPLATES, DELETE as DELETE_TEMPLATES } from '@/app/api/templates/route';
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('General APIs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Dashboard API', () => {
        it('should return dashboard stats', async () => {
            // Single CTE query returns all data at once
            mockPoolQuery.mockResolvedValueOnce({
                rows: [{
                    total: '100',
                    meta_matriculas: '100',
                    encaminhados_comercial: '0',
                    encaminhados_matriculados: '0',
                    whatsapp_messages_sent: '0',
                    templates_sent: '0',
                    status_counts: [
                        { status: 'LEAD', count: '50' },
                        { status: 'MATRICULADO', count: '10' }
                    ]
                }],
                rowCount: 1
            });

            const res = await GET_DASHBOARD();
            const data = await res.json();

            expect(data.total).toBe(100);
            expect(data.matriculados).toBe(10);
        });
    });

    describe('Settings API', () => {
        it('GET should return settings', async () => {
            mockPoolQuery.mockResolvedValue({
                rows: [{ key: 'openai_api_key', value: 'sk-123' }],
                rowCount: 1
            });

            const res = await GET_SETTINGS();
            const data = await res.json();

            expect(data.openaiApiKey).toBe('sk-...-123');
        });

        it('POST should update settings', async () => {
            mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });

            const req = new NextRequest('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify({ openaiApiKey: 'new-key' })
            });

            const res = await POST_SETTINGS(req);
            const data = await res.json();

            expect(data.success).toBe(true);
        });
    });

    describe('Templates API', () => {
        it('GET should return templates', async () => {
            mockPoolQuery.mockResolvedValue({
                rows: [{ id: 1, title: 'T1' }],
                rowCount: 1
            });

            const res = await GET_TEMPLATES();
            const data = await res.json();

            expect(data).toHaveLength(1);
        });

        it('POST should create template', async () => {
            mockPoolQuery.mockResolvedValue({
                rows: [{ id: 1, name: 'T1', message: 'C1' }],
                rowCount: 1
            });

            const req = new NextRequest('http://localhost/api/templates', {
                method: 'POST',
                body: JSON.stringify({ name: 'T1', message: 'C1' })
            });

            const res = await POST_TEMPLATES(req);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.id).toBe(1);
        });

        it('PUT should update template', async () => {
            mockPoolQuery
                .mockResolvedValueOnce({ rows: [{ id: 1, name: 'T1' }], rowCount: 1 }) // findById
                .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // update

            const req = new NextRequest('http://localhost/api/templates', {
                method: 'PUT',
                body: JSON.stringify({ id: 1, name: 'T1', message: 'C1' })
            });

            const res = await PUT_TEMPLATES(req);
            const data = await res.json();

            expect(data.success).toBe(true);
        });

        it('DELETE should delete template', async () => {
            mockPoolQuery
                .mockResolvedValueOnce({ rows: [{ id: 1, name: 'T1' }], rowCount: 1 }) // findById
                .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // delete

            const req = new NextRequest('http://localhost/api/templates?id=1');
            const res = await DELETE_TEMPLATES(req);
            const data = await res.json();

            expect(data.success).toBe(true);
        });
    });
});
