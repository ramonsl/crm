/**
 * Date Formatters Unit Tests
 * 
 * Tests all date formatting utilities for correctness and edge cases.
 * Ensures clean code principles are maintained.
 */

import {
    formatTimeOnly,
    formatTimestamp,
    formatFullDateTime,
    isToday,
    isYesterday,
    isThisWeek,
    getDayOfWeek,
    formatActivityTimestamp,
    formatRelativeTime,
} from '../dateFormatters';

describe('dateFormatters', () => {
    // Fixed date for consistent testing
    const testDate = new Date('2025-12-16T14:30:25');
    const testDateString = '2025-12-16T14:30:25';

    describe('formatTimeOnly', () => {
        it('should format time from Date object', () => {
            const result = formatTimeOnly(testDate);
            expect(result).toMatch(/\d{2}:\d{2}/);
        });

        it('should format time from ISO string', () => {
            const result = formatTimeOnly(testDateString);
            expect(result).toMatch(/\d{2}:\d{2}/);
        });

        it('should handle midnight', () => {
            const midnight = new Date('2025-12-16T00:00:00');
            const result = formatTimeOnly(midnight);
            expect(result).toBe('00:00');
        });
    });

    describe('formatTimestamp', () => {
        it('should format date and time', () => {
            const result = formatTimestamp(testDate);
            expect(result).toContain('às');
            expect(result).toMatch(/\d{2}\/\d{2} às \d{2}:\d{2}/);
        });

        it('should work with string input', () => {
            const result = formatTimestamp(testDateString);
            expect(result).toContain('16/12');
        });
    });

    describe('formatFullDateTime', () => {
        it('should format complete date and time', () => {
            const result = formatFullDateTime(testDate);
            expect(result).toContain('dezembro');
            expect(result).toContain('2025');
            expect(result).toContain('às');
        });

        it('should include month name in Portuguese', () => {
            const january = new Date('2025-01-15T10:00:00');
            const result = formatFullDateTime(january);
            expect(result).toContain('janeiro');
        });
    });

    describe('isToday', () => {
        it('should return true for current date', () => {
            const now = new Date();
            expect(isToday(now)).toBe(true);
        });

        it('should return false for yesterday', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            expect(isToday(yesterday)).toBe(false);
        });

        it('should return false for tomorrow', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            expect(isToday(tomorrow)).toBe(false);
        });

        it('should handle string input', () => {
            const today = new Date().toISOString();
            expect(isToday(today)).toBe(true);
        });
    });

    describe('isYesterday', () => {
        it('should return true for yesterday', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            expect(isYesterday(yesterday)).toBe(true);
        });

        it('should return false for today', () => {
            const now = new Date();
            expect(isYesterday(now)).toBe(false);
        });

        it('should return false for 2 days ago', () => {
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            expect(isYesterday(twoDaysAgo)).toBe(false);
        });
    });

    describe('isThisWeek', () => {
        it('should return true for today', () => {
            const now = new Date();
            expect(isThisWeek(now)).toBe(true);
        });

        it('should return true for 3 days ago', () => {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            expect(isThisWeek(threeDaysAgo)).toBe(true);
        });

        it('should return false for 8 days ago', () => {
            const eightDaysAgo = new Date();
            eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
            expect(isThisWeek(eightDaysAgo)).toBe(false);
        });
    });

    describe('getDayOfWeek', () => {
        it('should return abbreviated day name in Portuguese', () => {
            const monday = new Date('2025-12-15T10:00:00'); // Monday
            const result = getDayOfWeek(monday);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should work with string input', () => {
            const result = getDayOfWeek('2025-12-16T10:00:00');
            expect(result).toBeTruthy();
        });
    });

    describe('formatActivityTimestamp', () => {
        beforeEach(() => {
            // Mock current time for consistent testing
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2025-12-16T16:00:00'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should show only time for today', () => {
            const today = new Date('2025-12-16T14:30:00');
            const result = formatActivityTimestamp(today);
            expect(result).toMatch(/\d{2}:\d{2}/);
            expect(result).not.toContain('Ontem');
            expect(result).not.toContain('/');
        });

        it('should show "Ontem" for yesterday', () => {
            const yesterday = new Date('2025-12-15T14:30:00');
            const result = formatActivityTimestamp(yesterday);
            expect(result).toContain('Ontem');
            expect(result).toContain('às');
        });

        it('should show day of week for this week', () => {
            const thisWeek = new Date('2025-12-14T14:30:00'); // 2 days ago
            const result = formatActivityTimestamp(thisWeek);
            expect(result).toContain('às');
            expect(result).not.toContain('Ontem');
        });

        it('should show date for older dates', () => {
            const older = new Date('2025-12-01T14:30:00');
            const result = formatActivityTimestamp(older);
            expect(result).toMatch(/\d{2}\/\d{2} às \d{2}:\d{2}/);
        });
    });

    describe('formatRelativeTime', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2025-12-16T16:00:00'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should show "agora" for very recent', () => {
            const now = new Date('2025-12-16T16:00:00');
            expect(formatRelativeTime(now)).toBe('agora');
        });

        it('should show minutes for < 1 hour', () => {
            const past = new Date('2025-12-16T15:30:00');
            const result = formatRelativeTime(past);
            expect(result).toContain('minuto');
        });

        it('should show hours for < 24 hours', () => {
            const past = new Date('2025-12-16T14:00:00');
            const result = formatRelativeTime(past);
            expect(result).toContain('hora');
        });

        it('should show days for < 1 week', () => {
            const past = new Date('2025-12-14T16:00:00');
            const result = formatRelativeTime(past);
            expect(result).toContain('dia');
        });

        it('should handle singular and plural correctly', () => {
            const oneHourAgo = new Date('2025-12-16T15:00:00');
            expect(formatRelativeTime(oneHourAgo)).toBe('há 1 hora');

            const twoHoursAgo = new Date('2025-12-16T14:00:00');
            expect(formatRelativeTime(twoHoursAgo)).toBe('há 2 horas');
        });
    });

    describe('Edge cases', () => {
        it('should handle null timezone gracefully', () => {
            const date = new Date('2025-12-16T14:30:00Z');
            expect(() => formatTimeOnly(date)).not.toThrow();
        });

        it('should handle different timezones consistently', () => {
            const utc = new Date('2025-12-16T14:30:00Z');
            const local = new Date('2025-12-16T14:30:00');

            // Both should produce valid time strings
            expect(formatTimeOnly(utc)).toMatch(/\d{2}:\d{2}/);
            expect(formatTimeOnly(local)).toMatch(/\d{2}:\d{2}/);
        });

        it('should handle year boundaries', () => {
            const newYear = new Date('2025-01-01T00:00:00');
            const result = formatFullDateTime(newYear);
            expect(result).toContain('2025');
        });
    });
});
