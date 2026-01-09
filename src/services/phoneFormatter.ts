/**
 * BrazilianPhoneFormatter - Formats Brazilian phone numbers for WhatsApp
 * 
 * Follows SRP: Only responsible for phone number formatting
 * Uses phoneUtils for shared utilities (DRY principle)
 */

import { removeNonDigits as removeNonDigitsUtil } from '@/lib/utils/phoneUtils';

export interface PhoneVariation {
    formatted: string;
    type: '12-digit' | '13-digit' | 'landline' | 'international';
}

export class BrazilianPhoneFormatter {
    /**
     * Formats a Brazilian phone number and returns possible variations
     * @param phone - Raw phone number (may contain masks)
     * @returns Array of possible phone number variations for WhatsApp
     * @example
     * formatter.format('(51) 99999-8888')
     * // Returns: [
     * //   { formatted: '555198888888', type: '12-digit' },
     * //   { formatted: '5551999998888', type: '13-digit' }
     * // ]
     */
    format(phone: string): PhoneVariation[] {
        const cleaned = removeNonDigitsUtil(phone);
        const withoutLeadingZero = this.removeLeadingZero(cleaned);
        const withCountryCode = this.ensureCountryCode(withoutLeadingZero);

        return this.generateVariations(withCountryCode);
    }

    /**
     * Removes leading zero if present
     */
    private removeLeadingZero(phone: string): string {
        return phone.startsWith('0') ? phone.substring(1) : phone;
    }

    /**
     * Ensures country code (55) for Brazilian numbers
     */
    private ensureCountryCode(phone: string): string {
        const isBrazilianLength = phone.length === 10 || phone.length === 11;
        const needsCountryCode = isBrazilianLength && !phone.startsWith('55');

        return needsCountryCode ? '55' + phone : phone;
    }

    /**
     * Generates all possible variations for a phone number
     * Handles both 12-digit (without 9) and 13-digit (with 9) formats
     */
    private generateVariations(phone: string): PhoneVariation[] {
        if (!phone.startsWith('55')) {
            return [{ formatted: phone, type: 'international' }];
        }

        const variations: PhoneVariation[] = [];

        // 13 digits: 5551999998888
        if (phone.length === 13) {
            variations.push(
                this.create12DigitVariation(phone),
                this.create13DigitVariation(phone)
            );
        }
        // 12 digits: 555198888888
        else if (phone.length === 12) {
            variations.push(
                this.create12DigitVariation(phone),
                this.create13DigitVariationFrom12(phone)
            );
        }
        // Landline or other
        else {
            variations.push({ formatted: phone, type: 'landline' });
        }

        return variations;
    }

    /**
     * Creates 12-digit variation by removing the 9
     */
    private create12DigitVariation(phone: string): PhoneVariation {
        const formatted = phone.length === 13
            ? phone.substring(0, 4) + phone.substring(5)
            : phone;

        return { formatted, type: '12-digit' };
    }

    /**
     * Creates 13-digit variation (keeps as is)
     */
    private create13DigitVariation(phone: string): PhoneVariation {
        return { formatted: phone, type: '13-digit' };
    }

    /**
     * Creates 13-digit variation from 12-digit by adding 9
     */
    private create13DigitVariationFrom12(phone: string): PhoneVariation {
        const formatted = phone.substring(0, 4) + '9' + phone.substring(4);
        return { formatted, type: '13-digit' };
    }
}

