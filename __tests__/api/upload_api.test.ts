import { POST } from '@/app/api/upload/route';
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import * as XLSX from 'xlsx';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    },
    transaction: jest.fn(async (fn) => fn({
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    }))
}));

const mockPoolQuery = pool.query as jest.Mock;

// Mock XLSX
jest.mock('xlsx', () => ({
    read: jest.fn(),
    utils: {
        sheet_to_json: jest.fn()
    }
}));

describe('Upload API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('should process uploaded leads file', async () => {
        // Mock FormData
        const formData = new FormData();
        const file = new File(['dummy content'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        formData.append('file', file);
        formData.append('type', 'leads');

        // Mock Request
        const req = {
            formData: jest.fn().mockResolvedValue(formData),
            url: 'http://localhost/api/upload'
        } as unknown as NextRequest;

        // Mock XLSX
        (XLSX.read as jest.Mock).mockReturnValue({
            SheetNames: ['Sheet1'],
            Sheets: { 'Sheet1': {} }
        });

        (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
            ['Nome', 'Telefone', 'Curso', 'CPF'], // Header
            ['Test User', '5511999999999', 'ADS', '12345678900'] // Data
        ]);

        // Mock pool.query - return null for existing lead check
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.created).toBe(1);
        expect(mockPoolQuery).toHaveBeenCalled();
    });

    it('should return 400 if no file', async () => {
        const formData = new FormData();
        // No file appended

        const req = {
            formData: jest.fn().mockResolvedValue(formData),
            url: 'http://localhost/api/upload'
        } as unknown as NextRequest;

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should return 400 if header not found', async () => {
        const formData = new FormData();
        const file = new File([''], 'test.xlsx');
        formData.append('file', file);
        formData.append('type', 'leads');

        const req = {
            formData: jest.fn().mockResolvedValue(formData),
            url: 'http://localhost/api/upload'
        } as unknown as NextRequest;

        (XLSX.read as jest.Mock).mockReturnValue({
            SheetNames: ['Sheet1'],
            Sheets: { 'Sheet1': {} }
        });

        (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
            ['Invalid', 'Header']
        ]);

        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});
