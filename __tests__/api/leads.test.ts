import { GET, POST, PUT, DELETE } from '@/app/api/leads/route';
import { pool } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock the database
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
        connect: jest.fn(),
    },
    query: jest.fn(),
    queryOne: jest.fn(),
}));

// Mock repositories (if needed, but we might want to test integration with them)
// For now, we mock the db layer which repositories use.

const mockPoolQuery = pool.query as jest.Mock;

function createRequest(method: string, url: string, body?: unknown) {
    return new NextRequest(new URL(url, 'http://localhost'), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
}

describe('/api/leads', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET', () => {
        it('should return paginated leads (default)', async () => {
            // Mock count query
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ total: '2' }], rowCount: 1 });
            // Mock data query
            const mockLeads = [
                { cpf: '123', nome: 'Lead 1' },
                { cpf: '456', nome: 'Lead 2' }
            ];
            mockPoolQuery.mockResolvedValueOnce({ rows: mockLeads, rowCount: 2 });

            const req = createRequest('GET', '/api/leads');
            const res = await GET(req);
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data).toHaveLength(2);
            expect(json.pagination.total).toBe(2);
            expect(json.pagination.page).toBe(1);
        });

        it('should filter by search term', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ cpf: '123', nome: 'Lead 1' }], rowCount: 1 });

            const req = createRequest('GET', '/api/leads?search=Lead');
            await GET(req);

            // Verify query contains search logic
            const calls = mockPoolQuery.mock.calls;
            const countQuery = calls[0][0];
            const dataQuery = calls[1][0];
            const params = calls[1][1];

            expect(countQuery).toContain('ILIKE');
            expect(dataQuery).toContain('ILIKE');
            expect(params).toContain('%Lead%');
        });

        it('should filter by status', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const req = createRequest('GET', '/api/leads?status=NOVO');
            await GET(req);

            const calls = mockPoolQuery.mock.calls;
            const params = calls[1][1];
            expect(params).toContain('NOVO');
        });
    });

    describe('POST', () => {
        it('should create a new lead', async () => {
            // Mock check for existing (inside repository logic usually, but here checking inserts)
            // LeadRepository.create calls insert.
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ cpf: '11999999999', nome: 'New Lead' }], rowCount: 1 });

            const body = { nome: 'New Lead', telefone: '11999999999' };
            const req = createRequest('POST', '/api/leads', body);
            const res = await POST(req);

            expect(res.status).toBe(200);
            // Verify insert call
            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO leads'),
                expect.anything()
            );
        });

        it('should return 400 if required fields missing', async () => {
            const req = createRequest('POST', '/api/leads', {});
            const res = await POST(req);
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE', () => {
        it('should delete a lead by cpf', async () => {
            // Mock find (used in DELETE logic)
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ cpf: '123' }], rowCount: 1 });
            // Mock delete
            mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

            const req = createRequest('DELETE', '/api/leads?cpf=123');
            const res = await DELETE(req);

            expect(res.status).toBe(200);
            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM leads'),
                expect.anything()
            );
        });
    });

    describe('PUT', () => {
        it('should update a lead', async () => {
            // Mock find existing lead
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ cpf: '123', status: 'NOVO' }], rowCount: 1 });
            // Mock update
            mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });
            // Mock activity log (status change)
            mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });
            // Mock fetch updated
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ cpf: '123', status: 'EM_ATENDIMENTO' }], rowCount: 1 });

            const body = { cpf: '123', nome: 'Updated Name', telefone: '123456789', status: 'EM_ATENDIMENTO' };
            const req = createRequest('PUT', '/api/leads', body);
            const res = await PUT(req);

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.data.status).toBe('EM_ATENDIMENTO');
        });

        it('should return 404 if lead not found', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Not found

            const body = { cpf: '999', nome: 'Ghost', telefone: '000' };
            const req = createRequest('PUT', '/api/leads', body);
            const res = await PUT(req);

            expect(res.status).toBe(404);
        });
    });
});
