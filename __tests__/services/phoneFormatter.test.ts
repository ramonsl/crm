/**
 * Tests for BrazilianPhoneFormatter
 */

import { BrazilianPhoneFormatter } from '@/services/phoneFormatter';

describe('BrazilianPhoneFormatter', () => {
    let formatter: BrazilianPhoneFormatter;

    beforeEach(() => {
        formatter = new BrazilianPhoneFormatter();
    });

    describe('format()', () => {
        it('should format 11-digit mobile number (with 9)', () => {
            const variations = formatter.format('51999998888');

            expect(variations).toHaveLength(2);
            expect(variations[0].formatted).toBe('555199998888'); // 12-digit (remove 9)
            expect(variations[0].type).toBe('12-digit');
            expect(variations[1].formatted).toBe('5551999998888'); // 13-digit (original)
            expect(variations[1].type).toBe('13-digit');
        });

        it('should format 10-digit mobile number (without 9)', () => {
            const variations = formatter.format('5198888888');

            expect(variations).toHaveLength(2);
            expect(variations[0].formatted).toBe('555198888888'); // 12-digit
            expect(variations[0].type).toBe('12-digit');
            expect(variations[1].formatted).toBe('5551998888888'); // 13-digit (add 9)
            expect(variations[1].type).toBe('13-digit');
        });

        it('should handle number with mask (51) 99999-8888', () => {
            const variations = formatter.format('(51) 99999-8888');

            expect(variations[0].formatted).toBe('555199998888');
            expect(variations[1].formatted).toBe('5551999998888');
        });

        it('should remove leading zero', () => {
            const variations = formatter.format('051999998888');

            expect(variations[0].formatted).toBe('555199998888');
        });

        it('should handle number already with country code', () => {
            const variations = formatter.format('5551999998888');

            expect(variations).toHaveLength(2);
            expect(variations[0].formatted).toBe('555199998888'); // 12-digit
            expect(variations[1].formatted).toBe('5551999998888'); // 13-digit
        });

        it('should handle landline numbers', () => {
            const variations = formatter.format('5130001234');

            // Landlines também geram variações (10 dígitos)
            expect(variations).toHaveLength(2);
            expect(variations[0].type).toBe('12-digit');
        });

        it('should handle international numbers without BR code', () => {
            const variations = formatter.format('14155551234');

            // 11 dígitos = trata como BR e adiciona 55
            expect(variations).toHaveLength(2);
            expect(variations[0].type).toBe('12-digit');
        });

        it('should format real BR number 5181636027', () => {
            const variations = formatter.format('5181636027');

            expect(variations).toHaveLength(2);
            expect(variations[0].formatted).toBe('555181636027'); // 12-digit
            expect(variations[0].type).toBe('12-digit');
            expect(variations[1].formatted).toBe('5551981636027'); // 13-digit (add 9)
            expect(variations[1].type).toBe('13-digit');
        });

        it('should remove all non-digit characters', () => {
            const variations = formatter.format('+55 (51) 9 9999-8888');

            expect(variations[0].formatted).toBe('555199998888');
        });
    });
});
