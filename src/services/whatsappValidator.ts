/**
 * WhatsAppValidator - Validates phone numbers against WhatsApp
 * 
 * Follows SRP: Only responsible for WhatsApp validation
 * Follows DIP: Depends on abstractions (PhoneFormatter)
 */

import type { BrazilianPhoneFormatter, PhoneVariation } from './phoneFormatter';

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
        if (!this.isClientReady()) {
            throw new Error('WhatsApp client is not ready');
        }

        const variations = this.formatter.format(phone);
        console.log(`[WhatsAppValidator] Trying ${variations.length} variations for ${phone}`);

        for (const variation of variations) {
            const result = await this.tryValidation(variation);

            if (result.valid) {
                console.log(`[WhatsAppValidator] ✅ Valid: ${variation.formatted}`);
                return result;
            }
        }

        console.log(`[WhatsAppValidator] ❌ No valid variation found`);
        return { valid: false, chatId: null, variation: null };
    }

    /**
     * Checks if WhatsApp client is ready
     */
    private isClientReady(): boolean {
        return !!(global.whatsappClient && global.whatsappStatus === 'ready');
    }

    /**
     * Tries to validate a specific phone variation
     */
    private async tryValidation(
        variation: PhoneVariation
    ): Promise<ValidationResult> {
        try {
            const phoneWithPlus = `+${variation.formatted}`;

            const registeredUser = await this.withTimeout(
                global.whatsappClient!.getNumberId(phoneWithPlus)
            );

            if (registeredUser) {
                return {
                    valid: true,
                    chatId: registeredUser._serialized,
                    variation
                };
            }
        } catch (error) {
            console.warn(
                `[WhatsAppValidator] Validation failed for ${variation.formatted}:`,
                error instanceof Error ? error.message : error
            );
        }

        return { valid: false, chatId: null, variation: null };
    }

    /**
     * Wraps a promise with a timeout
     */
    private withTimeout<T>(promise: Promise<T>): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(
                    () => reject(new Error('Validation timeout')),
                    this.TIMEOUT_MS
                )
            )
        ]);
    }
}
