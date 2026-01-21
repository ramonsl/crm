import { POST, PUT, DELETE } from '@/app/api/leads/route';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
}));

const mockPoolQuery = pool.query as jest.Mock;

// Mock NextResponse
jest.mock('next/server', () => ({
    NextRequest: jest.fn(),
    NextResponse: {
        json: jest.fn((body, init) => ({ body, init, status: init?.status || 200 })),
    },
}));

describe('Leads API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a lead (POST)', async () => {
        const mockLead = {
            id: 1,
            cpf: '12345678900',
            nome: 'Test User',
            telefone: '5551999999999',
            email: 'test@example.com',
            status: 'Novo'
        };

        mockPoolQuery.mockResolvedValue({ rows: [mockLead], rowCount: 1 });

        const req = {
            json: jest.fn().mockResolvedValue({
                nome: 'Test User',
                email: 'test@example.com',
                telefone: '5551999999999',
                cpf: '12345678900',
                status: 'Novo',
                tipo_ingresso: '2025/1'
            })
        } as unknown as NextRequest;

        await POST(req);

        // Verify pool.query was called
        expect(mockPoolQuery).toHaveBeenCalled();
        const calls = mockPoolQuery.mock.calls;
        const hasInsert = calls.some((call: unknown[]) => (call[0] as string | undefined)?.includes('INSERT INTO leads'));
        expect(hasInsert).toBe(true);
        expect(NextResponse.json).toHaveBeenCalledWith({
            success: true,
            data: expect.objectContaining({ id: 1, nome: 'Test User' })
        });
    });

    it('should update a lead (PUT)', async () => {
        const mockLead = {
            id: 1,
            cpf: '12345678900',
            nome: 'Test User',
            telefone: '5551999999999',
        };

        // First call returns the existing lead, second call updates
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [mockLead], rowCount: 1 }) // find existing
            .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // update
            .mockResolvedValueOnce({ rows: [{ ...mockLead, nome: 'Updated User' }], rowCount: 1 }); // return updated

        const req = {
            json: jest.fn().mockResolvedValue({
                nome: 'Updated User',
                email: 'test@example.com',
                telefone: '5551999999999',
                cpf: '12345678900',
                status: 'Ativo',
                tipo_ingresso: '2025/1'
            })
        } as unknown as NextRequest;

        await PUT(req);

        // Verify pool.query was called
        expect(mockPoolQuery).toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith({
            success: true,
            data: expect.objectContaining({ id: 1 })
        });
    });

    it('should delete a lead (DELETE)', async () => {
        const mockLead = {
            id: 1,
            cpf: '12345678900',
        };

        mockPoolQuery
            .mockResolvedValueOnce({ rows: [mockLead], rowCount: 1 }) // find existing
            .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // delete

        const req = {
            url: 'http://localhost/api/leads?cpf=12345678900'
        } as unknown as NextRequest;

        await DELETE(req);

        // Verify pool.query was called
        expect(mockPoolQuery).toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith({ success: true });
    });
});
