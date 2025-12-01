import { POST } from '@/app/api/upload/route';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import * as XLSX from 'xlsx';

// Mock DB
jest.mock('@/lib/db', () => ({
    prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        get: jest.fn(), // for checkStmt
    }),
    transaction: jest.fn((fn) => fn), // Execute immediately
}));

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

        await POST(req);

        // Verify DB calls
        // We expect:
        // 1. prepare INSERT
        // 2. prepare UPDATE
        // 3. prepare SELECT (check)
        // 4. transaction execution
        // 5. checkStmt.get()
        // 6. insertStmt.run() (since checkStmt returns null by default mock)

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO leads'));
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
