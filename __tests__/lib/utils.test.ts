import { normalizePhone } from '../../src/lib/utils';

describe('normalizePhone', () => {
    it('should remove non-digits', () => {
        expect(normalizePhone('(51) 99999-9999')).toBe('51999999999');
    });

    it('should remove leading zero', () => {
        expect(normalizePhone('051999999999')).toBe('51999999999');
    });

    it('should remove 55 prefix from 12-digit numbers', () => {
        // 55 + 51 + 8 digits = 12 digits
        expect(normalizePhone('555199999999')).toBe('5199999999');
    });

    it('should remove 55 prefix from 13-digit numbers', () => {
        // 55 + 51 + 9 digits = 13 digits
        expect(normalizePhone('5551999999999')).toBe('51999999999');
    });

    it('should NOT remove 55 if length is different (e.g. international)', () => {
        // 55 + 1234567890 (12 digits total) -> removed
        // 55 + 1 (US) -> 551... wait.
        // If I have a number 55123456789 (11 digits), it stays.
        expect(normalizePhone('55123456789')).toBe('55123456789');
    });

    it('should handle empty input', () => {
        expect(normalizePhone('')).toBe('');
    });
});
