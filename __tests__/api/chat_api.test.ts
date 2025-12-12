import { GET } from '@/app/api/chat/messages/route';
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('Chat API', () => {
    it('should support after_id parameter', async () => {
        // Setup mock
        mockPoolQuery.mockImplementation((queryStr: string) => {
            if (queryStr.includes('FROM leads')) {
                return Promise.resolve({ rows: [{ cpf: '123' }], rowCount: 1 });
            }
            if (queryStr.includes('COUNT(*)')) {
                return Promise.resolve({ rows: [{ total: '10' }], rowCount: 1 });
            }
            return Promise.resolve({
                rows: [{ id: 101, body: 'New message', timestamp: '2023-01-01T12:00:00Z' }],
                rowCount: 1
            });
        });

        const req = new NextRequest('http://localhost/api/chat/messages?cpf=123&after_id=100');
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.messages).toHaveLength(1);
        expect(data.messages[0].id).toBe(101);

        // Verify pool.query was called
        expect(mockPoolQuery).toHaveBeenCalled();
    });
});
