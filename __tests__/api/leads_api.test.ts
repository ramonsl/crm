import { GET, POST, PUT, DELETE } from '@/app/api/leads/route';
import { NextRequest } from 'next/server';
import db from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn(),
    transaction: jest.fn((fn) => fn), // Mock transaction to just execute the function
}));

describe('Leads API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET', () => {
        it('should return paginated leads', async () => {
            const mockLeads = [
                { id: 1, nome: 'Test Lead', cpf: '12345678901' }
            ];
            const mockCount = { total: 1 };

            (db.prepare as jest.Mock).mockImplementation((query) => {
                if (query.includes('COUNT(*)')) return { get: jest.fn().mockReturnValue(mockCount) };
                return { all: jest.fn().mockReturnValue(mockLeads) };
            });

            const req = new NextRequest('http://localhost/api/leads?page=1&limit=10');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.data).toHaveLength(1);
            expect(data.pagination.total).toBe(1);
        });

        it('should filter by search term', async () => {
            (db.prepare as jest.Mock).mockImplementation((query) => {
                if (query.includes('COUNT(*)')) return { get: jest.fn().mockReturnValue({ total: 0 }) };
                return { all: jest.fn().mockReturnValue([]) };
            });

            const req = new NextRequest('http://localhost/api/leads?search=Test');
            await GET(req);

            const calls = (db.prepare as jest.Mock).mock.calls;
            const queryCall = calls.find(call => call[0].includes('LIKE ?'));
            expect(queryCall).toBeDefined();
        });
    });

    describe('POST', () => {
        it('should create a new lead', async () => {
            (db.prepare as jest.Mock).mockReturnValue({ run: jest.fn() });

            const req = new NextRequest('http://localhost/api/leads', {
                method: 'POST',
                body: JSON.stringify({
                    nome: 'New Lead',
                    email: 'test@example.com',
                    telefone: '5511999999999',
                    cpf: '12345678901'
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
            (db.prepare as jest.Mock).mockReturnValue({
                run: jest.fn().mockImplementation(() => {
                    throw { code: 'SQLITE_CONSTRAINT_PRIMARYKEY' };
                })
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
            (db.prepare as jest.Mock).mockReturnValue({
                run: jest.fn().mockReturnValue({ changes: 1 })
            });

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

        it('should handle CPF change with transaction', async () => {
            // Mock existing check to return null (new CPF doesn't exist)
            const mockGet = jest.fn().mockReturnValue(null);
            const mockRun = jest.fn();

            (db.prepare as jest.Mock).mockImplementation((query) => {
                if (query.includes('SELECT cpf FROM leads')) return { get: mockGet };
                return { run: mockRun };
            });

            const req = new NextRequest('http://localhost/api/leads', {
                method: 'PUT',
                body: JSON.stringify({
                    nome: 'Updated Lead',
                    telefone: '5511999999999',
                    cpf: '98765432100',
                    originalCpf: '12345678901'
                })
            });

            const res = await PUT(req);
            expect(res.status).toBe(200);
            expect(db.transaction).toHaveBeenCalled();
        });
    });

    describe('DELETE', () => {
        it('should delete a lead', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                run: jest.fn().mockReturnValue({ changes: 1 })
            });

            const req = new NextRequest('http://localhost/api/leads?cpf=12345678901');
            const res = await DELETE(req);

            expect(res.status).toBe(200);
        });

        it('should return 404 if lead not found', async () => {
            (db.prepare as jest.Mock).mockReturnValue({
                run: jest.fn().mockReturnValue({ changes: 0 })
            });

            const req = new NextRequest('http://localhost/api/leads?cpf=99999999999');
            const res = await DELETE(req);

            expect(res.status).toBe(404);
        });
    });
});
