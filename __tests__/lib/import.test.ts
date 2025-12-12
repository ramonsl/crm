import { POST } from '@/app/api/upload/route';
import { NextResponse } from 'next/server';
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
        } as any;

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
        const hasInsert = calls.some((call: any[]) => call[0]?.includes('INSERT INTO leads'));
        expect(hasInsert).toBe(true);
        expect(NextResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Success', created: 1 })
        );
    });

    it('should handle missing file', async () => {
        const formData = new Map(); // Empty

        const req = {
            formData: jest.fn().mockResolvedValue(formData)
        } as any;

        await POST(req);

        expect(NextResponse.json).toHaveBeenCalledWith(
            { error: 'No file uploaded' },
            { status: 400 }
        );
    });
});
