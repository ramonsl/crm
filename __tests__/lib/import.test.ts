import { POST } from '@/app/api/upload/route';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import * as XLSX from 'xlsx';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    },
    transaction: jest.fn(async (fn) => fn({
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    })),
}));

const mockPoolQuery = pool.query as jest.Mock;

// Mock XLSX
jest.mock('xlsx', () => ({
    read: jest.fn().mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { 'Sheet1': {} }
    }),
    utils: {
        sheet_to_json: jest.fn()
    }
}));

// Mock NextResponse
jest.mock('next/server', () => ({
    NextRequest: jest.fn(),
    NextResponse: {
        json: jest.fn((body, init) => ({ body, init })),
    },
}));

describe('Import API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('should process upload and insert leads', async () => {
        // Mock FormData
        const formData = new Map();
        formData.set('file', {
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
        });

        const req = {
            formData: jest.fn().mockResolvedValue(formData)
        } as unknown as NextRequest;

        // Mock XLSX data
        // Row 0: Header
        // Row 1: Data
        (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
            ['Nome', 'Email', 'Celular', 'CPF', 'Status'],
            ['Test User', 'test@example.com', '51999999999', '12345678900', 'Novo']
        ]);

        // Mock pool.query to return no existing lead
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

        await POST(req);

        // Verify DB calls
        expect(mockPoolQuery).toHaveBeenCalled();
        const calls = mockPoolQuery.mock.calls;
        const hasInsert = calls.some((call: unknown[]) => (call[0] as string | undefined)?.includes('INSERT INTO leads'));
        expect(hasInsert).toBe(true);
        expect(NextResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Success', created: 1 })
        );
    });

    it('should handle missing file', async () => {
        const formData = new Map(); // Empty

        const req = {
            formData: jest.fn().mockResolvedValue(formData)
        } as unknown as NextRequest;

        await POST(req);

        expect(NextResponse.json).toHaveBeenCalledWith(
            { error: 'No file uploaded' },
            { status: 400 }
        );
    });

    it('should NOT downgrade status when importing lower priority', async () => {
        // Mock FormData
        const formData = new Map();
        formData.set('file', {
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
        });

        const req = {
            formData: jest.fn().mockResolvedValue(formData)
        } as unknown as NextRequest;

        // Mock XLSX data - importing 'Inscrito Confirmado' (priority 4)
        (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
            ['Nome', 'Email', 'Celular', 'CPF', 'Situação'],
            ['Test User', 'test@example.com', '51999999999', '12345678900', 'Inscrito Confirmado']
        ]);

        // Mock existing lead with 'Matricula Confirmada' (priority 7)
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ cpf: '12345678900', status: 'Matricula Confirmada', notes: '' }],
            rowCount: 1
        });
        // Mock the UPDATE query
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

        await POST(req);

        // Verify UPDATE was called but status was NOT downgraded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateCalls = mockPoolQuery.mock.calls.filter((call: any[]) =>
            call[0]?.includes('UPDATE leads SET status')
        );
        expect(updateCalls.length).toBe(1);

        // The first parameter should be the existing status, not the new one
        const updateParams = updateCalls[0][1];
        expect(updateParams[0]).toBe('Matricula Confirmada'); // Status should NOT be downgraded
    });

    it('should upgrade status when importing higher priority', async () => {
        // Mock FormData
        const formData = new Map();
        formData.set('file', {
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
        });

        const req = {
            formData: jest.fn().mockResolvedValue(formData)
        } as unknown as NextRequest;

        // Mock XLSX data - importing 'Matricula Confirmada' (priority 7)
        (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
            ['Nome', 'Email', 'Celular', 'CPF', 'Situação'],
            ['Test User', 'test@example.com', '51999999999', '12345678900', 'Matricula Confirmada']
        ]);

        // Mock existing lead with 'Inscrito Confirmado' (priority 4)
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ cpf: '12345678900', status: 'Inscrito Confirmado', notes: '' }],
            rowCount: 1
        });
        // Mock the UPDATE query
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

        await POST(req);

        // Verify UPDATE was called with the new higher priority status
        const updateCalls = mockPoolQuery.mock.calls.filter((call: unknown[]) =>
            (call[0] as string | undefined)?.includes('UPDATE leads SET status')
        );
        expect(updateCalls.length).toBe(1);

        const updateParams = updateCalls[0][1];
        expect(updateParams[0]).toBe('Matricula Confirmada'); // Status should be upgraded
    });
});
