import { GET } from '@/app/api/settings/route';
import { pool } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
}));

jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((data) => ({ json: () => data })),
    },
}));

describe('Settings API - GET', () => {
    it('should mask sensitive API keys', async () => {
        (pool.query as jest.Mock).mockResolvedValue({
            rows: [
                { key: 'openai_api_key', value: 'sk-1234567890abcdef' },
                { key: 'ycloud_api_key', value: 'ycloud-secret-key-1234' },
                { key: 'comercial_name', value: 'Public Name' },
            ],
        });

        const response = await GET();
        const data = await response.json();

        expect(data.openaiApiKey).toBe('sk-...cdef');
        expect(data.yCloudApiKey).toBe('***1234');
        expect(data.comercialName).toBe('Public Name');
    });

    it('should handle empty keys gracefully', async () => {
        (pool.query as jest.Mock).mockResolvedValue({
            rows: [
                { key: 'openai_api_key', value: '' },
            ],
        });

        const response = await GET();
        const data = await response.json();

        expect(data.openaiApiKey).toBe('');
    });
});
