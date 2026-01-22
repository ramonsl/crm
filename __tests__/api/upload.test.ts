import { POST } from '@/app/api/upload/route';
import { pool } from '@/lib/db';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
}));

// Mock XLSX
jest.mock('xlsx', () => ({
    read: jest.fn(),
    utils: {
        sheet_to_json: jest.fn(),
    },
    SheetNames: ['Sheet1'],
    Sheets: { 'Sheet1': {} }
}));

const mockPoolQuery = pool.query as jest.Mock;
const mockSheetToJson = XLSX.utils.sheet_to_json as jest.Mock;
const mockRead = XLSX.read as jest.Mock;

function createRequestWithFile(data: string) {
    const formData = new FormData();
    const file = new File([data], 'leads.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', file);

    return new NextRequest(new URL('/api/upload', 'http://localhost'), {
        method: 'POST',
        body: formData,
    });
}

describe('/api/upload', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        // Setup default XLSX mock behavior
        mockRead.mockReturnValue({
            SheetNames: ['Sheet1'],
            Sheets: { 'Sheet1': {} }
        });
    });

    it('should create new lead from valid file', async () => {
        // Mock XLSX data: Header row + 1 Data row
        const mockRows = [
            ['CPF', 'Nome', 'Celular', 'Email', 'Status'],
            ['123.456.789-00', 'New Lead', '11999999999', 'test@test.com', 'NOVO']
        ];
        mockSheetToJson.mockReturnValue(mockRows);

        // Mock DB implementation
        mockPoolQuery.mockImplementation((query, params) => {
            if (query.includes('SELECT')) {
                return Promise.resolve({ rows: [], rowCount: 0 });
            }
            if (query.includes('INSERT INTO leads')) {
                return Promise.resolve({ rows: [{ cpf: '12345678900' }], rowCount: 1 });
            }
            if (query.includes('INSERT INTO activities')) {
                return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const req = createRequestWithFile('dummy content');
        const res = await POST(req);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.created).toBe(1);
    });

    it('should update existing lead if status priority allows', async () => {
        const mockRows = [
            ['CPF', 'Status'],
            ['123.456.789-00', 'MATRICULADO']
        ];
        mockSheetToJson.mockReturnValue(mockRows);

        // Mock DB implementation
        mockPoolQuery.mockImplementation((query, params) => {
            if (query.includes('SELECT')) {
                return Promise.resolve({
                    rows: [{ cpf: '12345678900', status: 'NOVO', notes: '' }],
                    rowCount: 1
                });
            }
            if (query.includes('UPDATE')) {
                return Promise.resolve({ rowCount: 1 });
            }
            if (query.includes('INSERT INTO status_message_logs')) {
                return Promise.resolve({ rowCount: 1 });
            }
            if (query.includes('INSERT INTO activities')) {
                return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const req = createRequestWithFile('dummy content');
        const res = await POST(req);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.updated).toBe(1);
    });

    it('should skip update if status priority is lower', async () => {
        const mockRows = [
            ['CPF', 'Status'],
            ['123.456.789-00', 'NOVO']
        ];
        mockSheetToJson.mockReturnValue(mockRows);

        // Mock DB implementation
        mockPoolQuery.mockImplementation((query, params) => {
            if (query.includes('SELECT')) {
                return Promise.resolve({
                    rows: [{ cpf: '12345678900', status: 'MATRICULADO', notes: '' }],
                    rowCount: 1
                });
            }
            if (query.includes('UPDATE')) {
                return Promise.resolve({ rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const req = createRequestWithFile('dummy content');
        const res = await POST(req);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.updated).toBe(1);

        // Verify that update was called but status remained MATRICULADO
        const updateCall = mockPoolQuery.mock.calls.find(call => call[0].includes('UPDATE leads SET'));
        expect(updateCall).toBeDefined();
        // check that status param passed to query matches EXISTING status (MATRICULADO), not new one (NOVO)
        // In the refactored version, status is passed in the params.
        const statusParam = updateCall[1].find((p: any) => p === 'MATRICULADO');
        expect(statusParam).toBe('MATRICULADO');
    });

    it('should merge lead if phone matches but CPF differs', async () => {
        const mockRows = [
            ['CPF', 'Nome', 'Celular', 'Status'],
            ['999.999.999-99', 'Duplicate Lead', '11999999999', 'NOVO']
        ];
        mockSheetToJson.mockReturnValue(mockRows);

        // Mock DB implementation
        mockPoolQuery.mockImplementation((query, params) => {
            // findByCpf (looking for the row's CPF)
            if (query.includes('SELECT') && query.includes('cpf = $1') && !query.includes('telefone')) {
                return Promise.resolve({ rows: [], rowCount: 0 });
            }
            // findConflictingPhone (looking for the phone)
            if (query.includes('SELECT') && query.includes('telefone = $1')) {
                return Promise.resolve({
                    rows: [{ cpf: '12345678900', status: 'NOVO', notes: '' }],
                    rowCount: 1
                });
            }
            if (query.includes('UPDATE')) {
                return Promise.resolve({ rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const req = createRequestWithFile('dummy content');
        const res = await POST(req);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.updated).toBe(1);
    });

    it('should return 400 if header row not found', async () => {
        const mockRows = [
            ['Wrong', 'Header'],
            ['Data', 'Row']
        ];
        mockSheetToJson.mockReturnValue(mockRows);

        const req = createRequestWithFile('dummy content');
        const res = await POST(req);

        expect(res.status).toBe(400);
    });
});
