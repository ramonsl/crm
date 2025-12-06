/**
 * Tests for Phone Utilities
 */

import {
    removeNonDigits,
    normalizePhoneNumber,
    getPhoneVariations,
    formatForWhatsApp
} from '@/lib/utils/phoneUtils';

describe('Phone Utils', () => {
    describe('removeNonDigits', () => {
        it('should remove all non-digit characters', () => {
            expect(removeNonDigits('(51) 99988-7766')).toBe('51999887766');
            expect(removeNonDigits('+55 51 9988-7766')).toBe('555199887766');
            expect(removeNonDigits('51-99988.7766')).toBe('51999887766');
        });

        it('should handle empty string', () => {
            expect(removeNonDigits('')).toBe('');
        });

        it('should handle only digits', () => {
            expect(removeNonDigits('51999887766')).toBe('51999887766');
        });

        it('should handle special characters', () => {
            expect(removeNonDigits('+55(51)99988-7766')).toBe('5551999887766');
        });
    });

    describe('normalizePhoneNumber', () => {
        it('should remove country code 55 from 12-digit number', () => {
            expect(normalizePhoneNumber('555199887766')).toBe('5199887766');
        });

        it('should remove country code 55 from 13-digit number', () => {
            expect(normalizePhoneNumber('5551999887766')).toBe('51999887766');
        });

        it('should remove leading zero', () => {
            expect(normalizePhoneNumber('051999887766')).toBe('51999887766');
        });

        it('should handle phone with formatting', () => {
            expect(normalizePhoneNumber('(51) 99988-7766')).toBe('51999887766');
        });

        it('should not remove 55 if not Brazilian pattern', () => {
            expect(normalizePhoneNumber('5512345')).toBe('5512345');
        });

        it('should handle empty string', () => {
            expect(normalizePhoneNumber('')).toBe('');
        });

        it('should handle phone already normalized', () => {
            expect(normalizePhoneNumber('51999887766')).toBe('51999887766');
        });
    });

    describe('getPhoneVariations', () => {
        it('should return variations for phone without country code (11 digits with 9)', () => {
            const variations = getPhoneVariations('51999887766');
            expect(variations).toContain('51999887766');  // original
            expect(variations).toContain('5551999887766'); // with 55
            expect(variations).toContain('5199887766');   // without 9th digit
            expect(variations).toContain('555199887766'); // with 55, without 9th digit
            expect(variations.length).toBe(4);
        });

        it('should return variations for phone with country code (13 digits with 9)', () => {
            const variations = getPhoneVariations('5551999887766');
            expect(variations).toContain('51999887766');  // normalized
            expect(variations).toContain('5551999887766'); // with 55
            expect(variations).toContain('5199887766');   // without 9th digit
            expect(variations).toContain('555199887766'); // with 55, without 9th digit
            expect(variations.length).toBe(4);
        });

        it('should handle phone with formatting', () => {
            const variations = getPhoneVariations('(51) 99988-7766');
            expect(variations).toContain('51999887766');
            expect(variations).toContain('5551999887766');
        });

        it('should not have duplicates', () => {
            const variations = getPhoneVariations('51999887766');
            const uniqueVariations = [...new Set(variations)];
            expect(variations.length).toBe(uniqueVariations.length);
        });

        it('should handle edge case with 55 prefix but short number', () => {
            const variations = getPhoneVariations('5512');
            expect(variations).toContain('5512');
        });
    });

    describe('formatForWhatsApp', () => {
        it('should add 55 to 10-digit number', () => {
            expect(formatForWhatsApp('5199887766')).toBe('555199887766');
        });

        it('should add 55 to 11-digit number', () => {
            expect(formatForWhatsApp('51999887766')).toBe('5551999887766');
        });

        it('should not add 55 if already present', () => {
            expect(formatForWhatsApp('5551999887766')).toBe('5551999887766');
        });

        it('should handle phone with formatting', () => {
            expect(formatForWhatsApp('(51) 99988-7766')).toBe('5551999887766');
        });

        it('should handle international numbers', () => {
            expect(formatForWhatsApp('123456789012')).toBe('123456789012');
        });
    });
});
