/**
 * Tests for WhatsAppValidator
 * Updated for Provider Interface Architecture
 */

import { WhatsAppValidator } from '@/services/whatsappValidator';
import { BrazilianPhoneFormatter } from '@/services/phoneFormatter';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';
import { IWhatsAppProvider } from '@/lib/whatsapp/IWhatsAppProvider';

// Mock the factory
// Mock the factory specific file
jest.mock('@/lib/whatsapp/factory/WhatsAppProviderFactory');
jest.mock('@/lib/logger');

describe('WhatsAppValidator', () => {
    let validator: WhatsAppValidator;
    let formatter: BrazilianPhoneFormatter;
    let mockProvider: jest.Mocked<IWhatsAppProvider>;

    beforeEach(() => {
        formatter = new BrazilianPhoneFormatter();
        validator = new WhatsAppValidator(formatter);

        // Mock provider instance
        mockProvider = {
            isReady: jest.fn().mockResolvedValue(true),
            validateNumber: jest.fn(),
            getStatus: jest.fn(),
            initialize: jest.fn(),
            logout: jest.fn(),
            sendTextMessage: jest.fn(),
            sendImage: jest.fn(),
            sendVideo: jest.fn(),
            sendAudio: jest.fn(),
            sendDocument: jest.fn(),
            sendMessage: jest.fn(),
            getProfilePicture: jest.fn(),
            getContactInfo: jest.fn(),
            onMessage: jest.fn(),
            onStatusChange: jest.fn(),
            restart: jest.fn(),
            clearSession: jest.fn()
        } as unknown as jest.Mocked<IWhatsAppProvider>;

        // Reset and setup factory mock
        (WhatsAppProviderFactory.getProvider as jest.Mock).mockReset();
        (WhatsAppProviderFactory.getProvider as jest.Mock).mockResolvedValue(mockProvider);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validate()', () => {
        it('should validate a valid WhatsApp number (12-digit)', async () => {
            mockProvider.validateNumber.mockResolvedValueOnce('555198888888');

            const result = await validator.validate('51998888888');

            expect(result.valid).toBe(true);
            expect(result.chatId).toBe('555198888888@s.whatsapp.net');
            expect(result.variation?.type).toBe('12-digit');
        });

        it('should validate a valid WhatsApp number (13-digit)', async () => {
            // First variation (12-digit) fails
            mockProvider.validateNumber.mockResolvedValueOnce(null);
            // Second variation (13-digit) succeeds
            mockProvider.validateNumber.mockResolvedValueOnce('5551999998888');

            const result = await validator.validate('51999998888');

            expect(result.valid).toBe(true);
            expect(result.chatId).toBe('5551999998888@s.whatsapp.net');
            expect(result.variation?.type).toBe('13-digit');
        });

        it('should return invalid for non-WhatsApp number', async () => {
            mockProvider.validateNumber.mockResolvedValue(null);

            const result = await validator.validate('51998888888');

            expect(result.valid).toBe(false);
            expect(result.chatId).toBeNull();
        });

        it('should throw error if client is not ready', async () => {
            // Explicitly set isReady to false for this test
            mockProvider.isReady.mockResolvedValue(false);

            await expect(validator.validate('51999998888')).rejects.toThrow(
                'WhatsApp client is not ready'
            );
        });

        it('should try multiple variations before giving up', async () => {
            // Ensure isReady is true (redundant but safe)
            mockProvider.isReady.mockResolvedValue(true);

            mockProvider.validateNumber
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);

            const result = await validator.validate('51999998888');

            expect(mockProvider.validateNumber).toHaveBeenCalledTimes(2);
            expect(result.valid).toBe(false);
        });
    });
});
