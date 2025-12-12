import { describe, it, expect } from '@jest/globals';
import { POST } from '@/app/api/whatsapp/sync-profile-pic/route';
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import * as whatsapp from '@/lib/whatsapp';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

const mockPoolQuery = pool.query as jest.Mock;

// Mock WhatsApp lib
jest.mock('@/lib/whatsapp', () => ({
    getContactProfilePicture: jest.fn()
}));

describe('Profile Sync API', () => {
    it('should sync profile picture successfully', async () => {
        // Setup mocks
        (whatsapp.getContactProfilePicture as jest.Mock).mockResolvedValue('https://example.com/pic.jpg');
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });

        const req = new NextRequest('http://localhost/api/whatsapp/sync-profile-pic', {
            method: 'POST',
            body: JSON.stringify({ phone: '5551999999999', cpf: '12345678900' })
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.profile_image).toBe('https://example.com/pic.jpg');

        // Verify DB update
        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE leads SET profile_image'),
            expect.arrayContaining(['https://example.com/pic.jpg', '12345678900'])
        );
    });

    it('should handle missing profile picture', async () => {
        (whatsapp.getContactProfilePicture as jest.Mock).mockResolvedValue(null);

        const req = new NextRequest('http://localhost/api/whatsapp/sync-profile-pic', {
            method: 'POST',
            body: JSON.stringify({ phone: '5551999999999', cpf: '12345678900' })
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(false);
        expect(data.message).toBe('No profile picture found');
    });
});
