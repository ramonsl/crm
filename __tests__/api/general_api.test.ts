import { GET as GET_DASHBOARD } from '@/app/api/dashboard/route';
import { GET as GET_SETTINGS, POST as POST_SETTINGS } from '@/app/api/settings/route';
import { GET as GET_TEMPLATES, POST as POST_TEMPLATES, PUT as PUT_TEMPLATES, DELETE as DELETE_TEMPLATES } from '@/app/api/templates/route';
import { NextRequest } from 'next/server';
import db from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn()
}));

describe('General APIs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Dashboard API', () => {
        it('should return dashboard stats', async () => {
            (db.prepare as jest.Mock).mockImplementation((query) => {
                if (query.includes('SELECT COUNT(*) as count FROM leads')) return { get: jest.fn().mockReturnValue({ count: 100 }) };
                if (query.includes('GROUP BY status')) return { all: jest.fn().mockReturnValue([{ status: 'LEAD', count: 50 }, { status: 'MATRICULADO', count: 10 }]) };
                if (query.includes('FROM settings')) return { get: jest.fn().mockReturnValue({ value: '100' }) };
                return { get: jest.fn(), all: jest.fn() };
            });

            const res = await GET_DASHBOARD();
            const data = await res.json();

            expect(data.total).toBe(100);
            expect(data.matriculados).toBe(10);
        });
    });

    describe('Settings API', () => {
        it('GET should return settings', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                all: jest.fn().mockReturnValue([
                    { key: 'openai_api_key', value: 'sk-123' }
                ])
            });

            const res = await GET_SETTINGS();
            const data = await res.json();

            expect(data.openaiApiKey).toBe('sk-123');
        });

        it('POST should update settings', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                run: jest.fn()
            });

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
            (db.prepare as jest.Mock).mockReturnValue({
                all: jest.fn().mockReturnValue([{ id: 1, title: 'T1' }])
            });

            const res = await GET_TEMPLATES();
            const data = await res.json();

            expect(data).toHaveLength(1);
        });

        it('POST should create template', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                run: jest.fn().mockReturnValue({ lastInsertRowid: 1 })
            });

            const req = new NextRequest('http://localhost/api/templates', {
                method: 'POST',
                body: JSON.stringify({ title: 'T1', content: 'C1' })
            });

            const res = await POST_TEMPLATES(req);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.id).toBe(1);
        });

        it('PUT should update template', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                run: jest.fn().mockReturnValue({ changes: 1 })
            });

            const req = new NextRequest('http://localhost/api/templates', {
                method: 'PUT',
                body: JSON.stringify({ id: 1, title: 'T1', content: 'C1' })
            });

            const res = await PUT_TEMPLATES(req);
            const data = await res.json();

            expect(data.success).toBe(true);
        });

        it('DELETE should delete template', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                run: jest.fn().mockReturnValue({ changes: 1 })
            });

            const req = new NextRequest('http://localhost/api/templates?id=1');
            const res = await DELETE_TEMPLATES(req);
            const data = await res.json();

            expect(data.success).toBe(true);
        });
    });
});
