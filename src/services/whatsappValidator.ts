/**
 * WhatsAppValidator - Validates phone numbers against WhatsApp
 * 
 * Follows SRP: Only responsible for WhatsApp validation
 * Follows DIP: Depends on abstractions (PhoneFormatter, WhatsAppProviderFactory)
 */

import type { BrazilianPhoneFormatter, PhoneVariation } from './phoneFormatter';
import { whatsappLogger } from '@/lib/logger';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';

export interface ValidationResult {
    valid: boolean;
    chatId: string | null;
    variation: PhoneVariation | null;
}

export class WhatsAppValidator {
    private readonly TIMEOUT_MS = 5000;

    constructor(
        private formatter: BrazilianPhoneFormatter
    ) { }

    /**
     * Validates if a phone number has WhatsApp
     * Tries multiple variations to find the correct format
     * 
     * @param phone - Phone number to validate
     * @returns Validation result with chatId if valid
     */
    async validate(phone: string): Promise<ValidationResult> {
        const isReady = await this.isClientReady();

        if (!isReady) {
            throw new Error('WhatsApp client is not ready');
        }

        const variations = this.formatter.format(phone);
        whatsappLogger.debug(`Trying ${variations.length} variations for ${phone}`);

        for (const variation of variations) {
            const result = await this.tryValidation(variation);

            if (result.valid) {
                whatsappLogger.debug(`Valid: ${variation.formatted}`);
                return result;
            }
        }

        whatsappLogger.debug('No valid variation found');
        return { valid: false, chatId: null, variation: null };
    }

    /**
     * Checks if WhatsApp client is ready
     */
    private async isClientReady(): Promise<boolean> {
        try {
            const provider = await WhatsAppProviderFactory.getProvider();
            return provider.isReady();
        } catch {
            return false;
        }
    }

    /**
     * Tries to validate a specific phone variation
     */
    private async tryValidation(
        variation: PhoneVariation
    ): Promise<ValidationResult> {
        try {
            const provider = await WhatsAppProviderFactory.getProvider();
            const validatedNumber = await provider.validateNumber(variation.formatted);

            if (validatedNumber) {
                return {
                    valid: true,
                    chatId: `${validatedNumber}@s.whatsapp.net`,
                    variation
                };
            }
        } catch (error) {
            whatsappLogger.warn(
                `Validation failed for ${variation.formatted}:`,
                error instanceof Error ? error.message : error
            );
        }

        return { valid: false, chatId: null, variation: null };
    }
}
