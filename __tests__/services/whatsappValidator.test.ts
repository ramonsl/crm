/**
 * Tests for WhatsAppValidator
 */

import { WhatsAppValidator } from '@/services/whatsappValidator';
import { BrazilianPhoneFormatter } from '@/services/phoneFormatter';

describe('WhatsAppValidator', () => {
    let validator: WhatsAppValidator;
    let formatter: BrazilianPhoneFormatter;
    let mockClient: any;

    beforeEach(() => {
        formatter = new BrazilianPhoneFormatter();
        validator = new WhatsAppValidator(formatter);

        // Mock WhatsApp client
        mockClient = {
            getNumberId: jest.fn()
        };

        global.whatsappClient = mockClient;
        global.whatsappStatus = 'ready';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validate()', () => {
        it('should validate a valid WhatsApp number (12-digit)', async () => {
            mockClient.getNumberId.mockResolvedValueOnce({
                _serialized: '555198888888@c.us'
            });

            const result = await validator.validate('51998888888');

            expect(result.valid).toBe(true);
            expect(result.chatId).toBe('555198888888@c.us');
            expect(result.variation?.type).toBe('12-digit');
        });

        it('should validate a valid WhatsApp number (13-digit)', async () => {
            // First variation (12-digit) fails
            mockClient.getNumberId.mockRejectedValueOnce(new Error('Not found'));
            // Second variation (13-digit) succeeds
            mockClient.getNumberId.mockResolvedValueOnce({
                _serialized: '5551999998888@c.us'
            });

            const result = await validator.validate('51999998888');

            expect(result.valid).toBe(true);
            expect(result.chatId).toBe('5551999998888@c.us');
            expect(result.variation?.type).toBe('13-digit');
        });

        it('should return invalid for non-WhatsApp number', async () => {
            mockClient.getNumberId.mockRejectedValue(new Error('Not found'));

            const result = await validator.validate('51998888888');

            expect(result.valid).toBe(false);
            expect(result.chatId).toBeNull();
        });

        it('should throw error if client is not ready', async () => {
            global.whatsappStatus = 'disconnected';

            await expect(validator.validate('51999998888')).rejects.toThrow(
                'WhatsApp client is not ready'
            );
        });

        it('should handle timeout gracefully', async () => {
            mockClient.getNumberId.mockImplementation(
                () => new Promise(resolve => setTimeout(resolve, 10000))
            );

            const result = await validator.validate('5551999998888');
            expect(result.valid).toBe(false);
        }, 15000); // Increase timeout to 15 seconds

        it('should try multiple variations before giving up', async () => {
            mockClient.getNumberId
                .mockRejectedValueOnce(new Error('Not found'))
                .mockRejectedValueOnce(new Error('Not found'));

            const result = await validator.validate('51999998888');

            expect(mockClient.getNumberId).toHaveBeenCalledTimes(2);
            expect(result.valid).toBe(false);
        });
    });
});
