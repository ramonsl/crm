import { POST, PUT, DELETE } from '@/app/api/leads/route';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
    }),
}));

// Mock NextResponse
jest.mock('next/server', () => ({
    NextRequest: jest.fn(),
    NextResponse: {
        json: jest.fn((body, init) => ({ body, init })),
    },
}));

describe('Leads API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a lead (POST)', async () => {
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

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO leads'));
        expect(NextResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should update a lead (PUT)', async () => {
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

        // Mock run to return changes > 0
        (db.prepare as jest.Mock).mockReturnValue({
            run: jest.fn().mockReturnValue({ changes: 1 })
        });

        const res = await PUT(req);

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE leads'));
        expect(NextResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should delete a lead (DELETE)', async () => {
        const req = {
            url: 'http://localhost/api/leads?cpf=12345678900'
        } as any;

        // Mock run to return changes > 0
        (db.prepare as jest.Mock).mockReturnValue({
            run: jest.fn().mockReturnValue({ changes: 1 })
        });

        const res = await DELETE(req);

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM leads'));
        expect(NextResponse.json).toHaveBeenCalledWith({ success: true });
    });
});
