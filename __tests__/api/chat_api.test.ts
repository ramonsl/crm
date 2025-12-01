import { GET } from '@/app/api/chat/messages/route';
import { NextRequest } from 'next/server';
import db from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn()
}));

describe('Chat API', () => {
    it('should support after_id parameter', async () => {
        // Setup mock
        const mockAll = jest.fn().mockReturnValue([
            { id: 101, body: 'New message', timestamp: '2023-01-01T12:00:00Z' }
        ]);
        const mockGet = jest.fn().mockReturnValue({ cpf: '123' });

        (db.prepare as jest.Mock).mockImplementation((query) => {
            if (query.includes('FROM leads')) return { get: mockGet };
            if (query.includes('COUNT(*)')) return { get: jest.fn().mockReturnValue({ total: 10 }) };
            return { all: mockAll };
        });

        const req = new NextRequest('http://localhost/api/chat/messages?cpf=123&after_id=100');
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.messages).toHaveLength(1);
        expect(data.messages[0].id).toBe(101);

        // Verify the query used the after_id logic (id > ?)
        const calls = (db.prepare as jest.Mock).mock.calls;
        const queryCall = calls.find(call => call[0].includes('id > ?'));
        expect(queryCall).toBeDefined();
    });
});
