import { GET } from '@/app/api/dashboard/route';
import { pool } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
    query: jest.fn(),
    queryOne: jest.fn(),
}));

const mockPoolQuery = pool.query as jest.Mock;

function createRequest(method: string, url: string) {
    return new NextRequest(new URL(url, 'http://localhost'), { method });
}

describe('/api/dashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return correct dashboard metrics', async () => {
        // Single optimized query with all data in one CTE
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{
                total: '100',
                meta_matriculas: '50',
                encaminhados_comercial: '10',
                encaminhados_matriculados: '5',
                whatsapp_messages_sent: '100',
                templates_sent: '50',
                status_counts: [
                    { status: 'NOVO', count: '50' },
                    { status: 'INSCRITO', count: '20' },
                    { status: 'MATRICULADO', count: '30' }
                ]
            }],
            rowCount: 1
        });

        const req = createRequest('GET', '/api/dashboard');
        const res = await GET();

        expect(res.status).toBe(200);
        const data = await res.json();

        // Verify calculations
        expect(data.total).toBe(100);
        expect(data.matriculados).toBe(30); // From status counts
        expect(data.metaMatriculas).toBe(50);

        // Conversion Logic:
        // conversionRate = (matriculados / total) * 100 = (30/100)*100 = 30.0
        expect(data.conversionRate).toBe('30.0');

        // Taxa conversão comercial = (encaminhadosMatriculados / encaminhadosComercial) * 100
        // (5 / 10) * 100 = 50.0
        expect(data.taxaConversaoComercial).toBe('50.0');

        // Total messages = 100 + 50
        expect(data.totalMessagesSent).toBe(150);
        expect(data.whatsappMessagesSent).toBe(100);
        expect(data.templatesSent).toBe(50);
    });

    it('should handle zero values gracefully', async () => {
        // Single query returning zeros
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{
                total: '0',
                meta_matriculas: '0',
                encaminhados_comercial: '0',
                encaminhados_matriculados: '0',
                whatsapp_messages_sent: '0',
                templates_sent: '0',
                status_counts: []
            }],
            rowCount: 1
        });

        const res = await GET();
        const data = await res.json();

        expect(data.total).toBe(0);
        expect(data.conversionRate).toBe('0.0');
        expect(data.taxaConversaoComercial).toBe('0.0');
        expect(data.totalMessagesSent).toBe(0);
    });
});
