/**
 * Tests for ContactSyncService
 * Updated for Provider Interface Architecture
 */

import { ContactSyncService } from '@/services/contactSyncService';
import type { WhatsAppValidator } from '@/services/whatsappValidator';
import type { IContactRepository } from '@/repositories/contactRepository';
import { IWhatsAppProvider } from '@/lib/whatsapp/IWhatsAppProvider';

// Mock the factory
jest.mock('@/lib/whatsapp/factory/WhatsAppProviderFactory', () => ({
    WhatsAppProviderFactory: {
        getProvider: jest.fn()
    }
}));
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';
jest.mock('@/lib/logger');

describe('ContactSyncService', () => {
    let syncService: ContactSyncService;
    let mockValidator: jest.Mocked<WhatsAppValidator>;
    let mockRepository: jest.Mocked<IContactRepository>;
    let mockProvider: jest.Mocked<IWhatsAppProvider>;

    beforeEach(() => {
        // Mock validator
        mockValidator = {
            validate: jest.fn()
        } as unknown as jest.Mocked<WhatsAppValidator>;

        // Mock repository
        mockRepository = {
            updateWhatsAppData: jest.fn().mockResolvedValue(undefined),
            findByPhone: jest.fn().mockResolvedValue({ nome: 'João Silva' })
        } as unknown as jest.Mocked<IContactRepository>;

        // Mock provider instance
        mockProvider = {
            getProfilePicture: jest.fn().mockResolvedValue('https://example.com/pic.jpg')
        } as unknown as jest.Mocked<IWhatsAppProvider>;

        // Initialize mocks - Provider Factory is already imported at top
        (WhatsAppProviderFactory.getProvider as jest.Mock).mockResolvedValue(mockProvider);

        syncService = new ContactSyncService(mockValidator, mockRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('syncContact()', () => {
        it('should sync valid WhatsApp contact with all data', async () => {
            // Mock validation
            mockValidator.validate.mockResolvedValue({
                valid: true,
                chatId: '5551999998888@c.us',
                variation: { formatted: '5551999998888', type: '13-digit' }
            });

            const result = await syncService.syncContact('51999998888');

            expect(result.valid).toBe(true);
            expect(result.chatId).toBe('5551999998888@c.us');
            expect(result.profilePicture).toBe('https://example.com/pic.jpg');
            expect(result.updated).toBe(true);

            // Verify database was updated
            expect(mockRepository.updateWhatsAppData).toHaveBeenCalledWith(
                '51999998888',
                expect.objectContaining({
                    whatsapp_valido: true,
                    profile_picture: 'https://example.com/pic.jpg'
                })
            );
        });

        it('should handle invalid WhatsApp number', async () => {
            mockValidator.validate.mockResolvedValue({
                valid: false,
                chatId: null,
                variation: null
            });

            const result = await syncService.syncContact('51999998888');

            expect(result.valid).toBe(false);
            expect(result.updated).toBe(true); // Still updated (marked as invalid)

            // Should mark as invalid in DB
            expect(mockRepository.updateWhatsAppData).toHaveBeenCalledWith(
                '51999998888',
                expect.objectContaining({
                    whatsapp_valido: false
                })
            );
        });

        it('should handle errors gracefully', async () => {
            mockValidator.validate.mockRejectedValue(new Error('Network error'));

            const result = await syncService.syncContact('51999998888');

            expect(result.valid).toBe(false);
            expect(result.updated).toBe(false);
            expect(result.error).toBe('Network error');
        });

        it('should handle missing profile picture', async () => {
            mockValidator.validate.mockResolvedValue({
                valid: true,
                chatId: '5551999998888@c.us',
                variation: { formatted: '5551999998888', type: '13-digit' }
            });

            // Profile picture not available
            mockProvider.getProfilePicture.mockResolvedValue(null);

            const result = await syncService.syncContact('51999998888');

            expect(result.valid).toBe(true);
            expect(result.profilePicture).toBeNull();
        });
    });
});
