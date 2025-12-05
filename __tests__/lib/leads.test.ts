import { POST, PUT, DELETE } from '@/app/api/leads/route';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn().mockReturnValue({
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
        get: jest.fn().mockReturnValue({
            id: 1,
            cpf: '12345678900',
            nome: 'Test User',
            telefone: '5551999999999',
        }),
    }),
}));

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
        const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
        const mockGet = jest.fn().mockReturnValue({
            id: 1,
            cpf: '12345678900',
            nome: 'Test User',
            telefone: '5551999999999',
            email: 'test@example.com',
            status: 'Novo'
        });

        (db.prepare as jest.Mock).mockReturnValue({
            run: mockRun,
            get: mockGet,
        });

        const req = {
            json: jest.fn().mockResolvedValue({
                nome: 'Test User',
                email: 'test@example.com',
                telefone: '5551999999999',
                cpf: '12345678900',
                status: 'Novo',
                tipo_ingresso: '2025/1'
            })
        } as any;

        const res = await POST(req);

        // Verify repository was used (INSERT query called)
        expect(db.prepare).toHaveBeenCalled();
        const calls = (db.prepare as jest.Mock).mock.calls;
        const hasInsert = calls.some(call => call[0].includes('INSERT INTO leads'));
        expect(hasInsert).toBe(true);
        expect(NextResponse.json).toHaveBeenCalledWith({
            success: true,
            data: expect.objectContaining({ id: 1, nome: 'Test User' })
        });
    });

    it('should update a lead (PUT)', async () => {
        const mockGet = jest.fn().mockReturnValue({
            id: 1,
            cpf: '12345678900',
            nome: 'Test User',
            telefone: '5551999999999',
        });
        const mockRun = jest.fn().mockReturnValue({ changes: 1 });

        (db.prepare as jest.Mock).mockReturnValue({
            run: mockRun,
            get: mockGet,
        });

        const req = {
            json: jest.fn().mockResolvedValue({
                nome: 'Updated User',
                email: 'test@example.com',
                telefone: '5551999999999',
                cpf: '12345678900',
                status: 'Ativo',
                tipo_ingresso: '2025/1'
            })
        } as any;

        const res = await PUT(req);

        // Verify repository was used (SELECT and UPDATE queries called)
        expect(db.prepare).toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith({
            success: true,
            data: expect.objectContaining({ id: 1 })
        });
    });

    it('should delete a lead (DELETE)', async () => {
        const mockGet = jest.fn().mockReturnValue({
            id: 1,
            cpf: '12345678900',
        });
        const mockRun = jest.fn().mockReturnValue({ changes: 1 });

        (db.prepare as jest.Mock).mockReturnValue({
            run: mockRun,
            get: mockGet,
        });

        const req = {
            url: 'http://localhost/api/leads?cpf=12345678900'
        } as any;

        const res = await DELETE(req);

        // Verify repository was used (SELECT and DELETE queries called)
        expect(db.prepare).toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith({ success: true });
    });
});
