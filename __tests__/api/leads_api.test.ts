import { GET, POST, PUT, DELETE } from '@/app/api/leads/route';
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
    transaction: jest.fn(async (fn) => fn({
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    })),
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('Leads API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET', () => {
        it('should return paginated leads', async () => {
            const mockLeads = [
                { id: 1, nome: 'Test Lead', cpf: '12345678901' }
            ];

            mockPoolQuery.mockImplementation((queryStr: string) => {
                if (queryStr.includes('COUNT(*)')) {
                    return Promise.resolve({ rows: [{ total: '1' }], rowCount: 1 });
                }
                return Promise.resolve({ rows: mockLeads, rowCount: 1 });
            });

            const req = new NextRequest('http://localhost/api/leads?page=1&limit=10');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.pagination.total).toBe(1);
        });

        it('should filter by search term', async () => {
            mockPoolQuery.mockImplementation((queryStr: string) => {
                if (queryStr.includes('COUNT(*)')) {
                    return Promise.resolve({ rows: [{ total: '0' }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            const req = new NextRequest('http://localhost/api/leads?search=Test');
            await GET(req);

            const calls = mockPoolQuery.mock.calls;
            const queryCall = calls.find((call: any[]) => call[0]?.includes('ILIKE'));
            expect(queryCall).toBeDefined();
        });
    });

    describe('POST', () => {
        it('should create a new lead', async () => {
            const mockLead = {
                id: 1,
                cpf: '12345678901',
                nome: 'Test Lead',
                telefone: '51999999999',
                email: 'test@test.com',
                status: 'NOVO'
            };

            mockPoolQuery.mockResolvedValue({ rows: [mockLead], rowCount: 1 });

            const req = new NextRequest('http://localhost/api/leads', {
                method: 'POST',
                body: JSON.stringify({
                    nome: 'Test Lead',
                    telefone: '51999999999',
                    cpf: '12345678901',
                    email: 'test@test.com'
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should return error if name or phone is missing', async () => {
            const req = new NextRequest('http://localhost/api/leads', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com'
                })
            });

            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it('should handle duplicate CPF', async () => {
            mockPoolQuery.mockImplementation(() => {
                const error: any = new Error('duplicate key value');
                error.code = '23505';
                return Promise.reject(error);
            });

            const req = new NextRequest('http://localhost/api/leads', {
                method: 'POST',
                body: JSON.stringify({
                    nome: 'Duplicate Lead',
                    telefone: '5511999999999',
                    cpf: '12345678901'
                })
            });

            const res = await POST(req);
            expect(res.status).toBe(409);
        });
    });

    describe('PUT', () => {
        it('should update an existing lead', async () => {
            const mockLead = {
                id: 1,
                cpf: '12345678901',
                nome: 'Test Lead',
                telefone: '51999999999',
            };

            mockPoolQuery
                .mockResolvedValueOnce({ rows: [mockLead], rowCount: 1 }) // find
                .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // update
                .mockResolvedValueOnce({ rows: [{ ...mockLead, nome: 'Updated Lead' }], rowCount: 1 }); // return

            const req = new NextRequest('http://localhost/api/leads', {
                method: 'PUT',
                body: JSON.stringify({
                    nome: 'Updated Lead',
                    telefone: '5511999999999',
                    cpf: '12345678901',
                    originalCpf: '12345678901'
                })
            });

            const res = await PUT(req);
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE', () => {
        it('should delete a lead', async () => {
            const mockLead = {
                id: 1,
                cpf: '12345678901',
            };

            mockPoolQuery
                .mockResolvedValueOnce({ rows: [mockLead], rowCount: 1 }) // find
                .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // delete

            const req = new NextRequest('http://localhost/api/leads?cpf=12345678901');
            const res = await DELETE(req);

            expect(res.status).toBe(200);
        });

        it('should return 404 if lead not found', async () => {
            mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

            const req = new NextRequest('http://localhost/api/leads?cpf=99999999999');
            const res = await DELETE(req);

            expect(res.status).toBe(404);
        });
    });
});
