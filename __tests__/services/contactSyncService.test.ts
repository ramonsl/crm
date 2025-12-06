/**
 * Tests for ContactSyncService
 */

import { ContactSyncService } from '@/services/contactSyncService';
import type { WhatsAppValidator } from '@/services/whatsappValidator';
import type { IContactRepository } from '@/repositories/contactRepository';

describe('ContactSyncService', () => {
    let syncService: ContactSyncService;
    let mockValidator: jest.Mocked<WhatsAppValidator>;
    let mockRepository: jest.Mocked<IContactRepository>;
    let mockClient: any;

    beforeEach(() => {
        // Mock validator
        mockValidator = {
            validate: jest.fn()
        } as any;

        // Mock repository
        mockRepository = {
            updateWhatsAppData: jest.fn().mockResolvedValue(undefined),
            findByPhone: jest.fn().mockResolvedValue({ nome: 'João Silva' })
        };

        // Mock WhatsApp client
        mockClient = {
            getChatById: jest.fn(),
            getContactProfilePicture: jest.fn()
        };

        global.whatsappClient = mockClient;

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

            // Mock chat
            const mockChat = {
                fetchMessages: jest.fn().mockResolvedValue([
                    {
                        body: 'Olá, tudo bem?',
                        timestamp: 1701795600
                    }
                ])
            };
            mockClient.getChatById.mockResolvedValue(mockChat);

            const result = await syncService.syncContact('51999998888');

            expect(result.valid).toBe(true);
            expect(result.chatId).toBe('5551999998888@c.us');
            expect(result.lastMessage).toBe('Olá, tudo bem?');
            expect(result.updated).toBe(true);

            // Verify database was updated
            expect(mockRepository.updateWhatsAppData).toHaveBeenCalledWith(
                '51999998888',
                expect.objectContaining({
                    whatsapp_valido: true,
                    last_message: 'Olá, tudo bem?'
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

        it('should handle missing chat data', async () => {
            mockValidator.validate.mockResolvedValue({
                valid: true,
                chatId: '5551999998888@c.us',
                variation: { formatted: '5551999998888', type: '13-digit' }
            });

            // Chat has no messages
            const mockChat = {
                fetchMessages: jest.fn().mockResolvedValue([])
            };
            mockClient.getChatById.mockResolvedValue(mockChat);

            const result = await syncService.syncContact('51999998888');

            expect(result.valid).toBe(true);
            expect(result.lastMessage).toBeNull();
        });
    });
});
