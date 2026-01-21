import { describe, it, expect } from '@jest/globals';
import { POST } from '@/app/api/whatsapp/sync-profile-pic/route';
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';
import { IWhatsAppProvider } from '@/lib/whatsapp/IWhatsAppProvider';
import fs from 'fs';

// Mock DB
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

// Mock Factory
jest.mock('@/lib/whatsapp/factory', () => ({
    WhatsAppProviderFactory: {
        getProvider: jest.fn()
    }
}));

// Mock fs
jest.mock('fs');
jest.mock('path', () => ({
    join: (...args: string[]) => args.join('/'),
    extname: () => '.jpg'
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('Profile Sync API', () => {
    let mockProvider: jest.Mocked<IWhatsAppProvider>;

    beforeEach(() => {
        // Setup mock provider
        mockProvider = {
            initialize: jest.fn(),
            restart: jest.fn(),
            logout: jest.fn(),
            clearSession: jest.fn(),
            getStatus: jest.fn().mockResolvedValue({ status: 'ready' }),
            isReady: jest.fn().mockResolvedValue(true),
            sendTextMessage: jest.fn(),
            sendImage: jest.fn(),
            sendVideo: jest.fn(),
            sendAudio: jest.fn(),
            sendDocument: jest.fn(),
            sendMessage: jest.fn(),
            getProfilePicture: jest.fn().mockResolvedValue('https://example.com/pic.jpg'),
            getContactInfo: jest.fn(),
            validateNumber: jest.fn(),
            onMessage: jest.fn(),
            onStatusChange: jest.fn(),
            offMessage: jest.fn(),
            offStatusChange: jest.fn(),
            getProviderName: jest.fn().mockReturnValue('Mock'),
            getProviderVersion: jest.fn().mockReturnValue('1.0.0'),
            listGroups: jest.fn(),
            getGroupParticipants: jest.fn(),
            isNumberInGroup: jest.fn(),
            onLog: jest.fn(),
            offLog: jest.fn(),
        };
        (WhatsAppProviderFactory.getProvider as jest.Mock).mockResolvedValue(mockProvider);

        // Setup DB mock
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });

        // Setup FS mocks
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.mkdirSync as jest.Mock).mockImplementation(() => { });
        (fs.writeFileSync as jest.Mock).mockImplementation(() => { });

        // Setup global fetch
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
            headers: {
                get: () => 'image/jpeg'
            }
        } as unknown as Response);
    });

    it('should sync profile picture successfully (download and cache)', async () => {
        const req = new NextRequest('http://localhost/api/whatsapp/sync-profile-pic', {
            method: 'POST',
            body: JSON.stringify({ phone: '5551999999999', cpf: '12345678900' })
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        // Agora retorna uma URL local da API
        expect(data.profile_image).toMatch(/^\/api\/profile-pic\//);

        // Verify download was attempted
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/pic.jpg');

        // Verify file was saved
        expect(fs.writeFileSync).toHaveBeenCalled();

        // Verify DB update
        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE leads SET profile_image'),
            expect.arrayContaining([expect.stringMatching(/^\/api\/profile-pic\//), '12345678900'])
        );
    });

    it('should handle missing profile picture', async () => {
        mockProvider.getProfilePicture.mockResolvedValue(null);

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

    it('should fallback to remote URL if download fails', async () => {
        // Mock download failure
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Download failed'));

        const req = new NextRequest('http://localhost/api/whatsapp/sync-profile-pic', {
            method: 'POST',
            body: JSON.stringify({ phone: '5551999999999', cpf: '12345678900' })
        });

        const res = await POST(req);
        const data = await res.json();

        expect(data.success).toBe(true);
        // Deve retornar a URL original como fallback
        expect(data.profile_image).toBe('https://example.com/pic.jpg');

        // Verifica se salvou a URL remota no banco
        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE leads SET profile_image'),
            expect.arrayContaining(['https://example.com/pic.jpg', '12345678900'])
        );
    });
});
