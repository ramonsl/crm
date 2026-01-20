"use strict";
/**
 * Phone Utilities
 * Centralized phone number formatting following SRP and DRY principles
 *
 * @module phoneUtils
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeNonDigits = removeNonDigits;
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.getPhoneVariations = getPhoneVariations;
exports.formatForWhatsApp = formatForWhatsApp;
exports.normalizePhoneForSocket = normalizePhoneForSocket;
/**
 * Remove all non-digit characters from phone number
 *
 * @param phone - Phone number with any format
 * @returns Phone number with only digits
 *
 * @example
 * removeNonDigits('(51) 99988-7766') // '51999887766'
 * removeNonDigits('+55 51 9988-7766') // '5551999887766'
 */
function removeNonDigits(phone) {
    if (!phone)
        return '';
    return phone.replace(/\D/g, '');
}
/**
 * Normalize phone number by removing country code and leading zeros
 *
 * @param phone - Phone number in any format
 * @returns Normalized phone number (without country code)
 *
 * @example
 * normalizePhoneNumber('5551999887766') // '51999887766'
 * normalizePhoneNumber('051999887766') // '51999887766'
 * normalizePhoneNumber('(51) 99988-7766') // '51999887766'
 */
function normalizePhoneNumber(phone) {
    const digits = removeNonDigits(phone);
    // Remove leading 0
    if (digits.startsWith('0')) {
        return digits.substring(1);
    }
    // Remove Brazilian country code (55) if 12 or 13 digits
    // 55 + 2-digit area code + 8/9-digit number = 12/13 digits
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        return digits.substring(2);
    }
    return digits;
}
/**
 * Get phone number variations for database queries
 * Returns array with phone variations (with and without country code 55, with and without 9th digit)
 *
 * @param phone - Phone number in any format
 * @returns Array of phone variations, without duplicates
 *
 * @example
 * getPhoneVariations('51999887766')
 * // Returns: ['51999887766', '5551999887766', '5199887766', '555199887766']
 *
 * getPhoneVariations('5551999887766')
 * // Returns: ['51999887766', '5551999887766', '5199887766', '555199887766']
 */
function getPhoneVariations(phone) {
    const normalized = normalizePhoneNumber(phone);
    const variations = [normalized];
    // Add variation with country code if not present
    if (!normalized.startsWith('55')) {
        variations.push('55' + normalized);
    }
    // Add variation without country code if present
    if (normalized.startsWith('55') && normalized.length > 2) {
        const withoutCode = normalized.substring(2);
        if (!variations.includes(withoutCode)) {
            variations.push(withoutCode);
        }
    }
    // Handle Brazilian 9th digit variations (mobile numbers)
    // Brazilian mobile: 2 digit DDD + 9 + 8 digits = 11 digits
    // Or without 9th digit: 2 digit DDD + 8 digits = 10 digits
    const basePhone = normalized.startsWith('55') ? normalized.substring(2) : normalized;
    if (basePhone.length === 11 && basePhone[2] === '9') {
        // Has 9th digit, also try without it
        const without9 = basePhone.substring(0, 2) + basePhone.substring(3);
        variations.push(without9);
        variations.push('55' + without9);
    }
    else if (basePhone.length === 10) {
        // No 9th digit, also try with it
        const with9 = basePhone.substring(0, 2) + '9' + basePhone.substring(2);
        variations.push(with9);
        variations.push('55' + with9);
    }
    // Remove duplicates using Set
    return [...new Set(variations)];
}
/**
 * Format phone number for WhatsApp
 * Adds Brazilian country code (55) if the number appears to be Brazilian
 *
 * @param phone - Phone number in any format
 * @returns Phone formatted for WhatsApp (with country code)
 *
 * @example
 * formatForWhatsApp('51999887766') // '5551999887766'
 * formatForWhatsApp('5551999887766') // '5551999887766'
 */
function formatForWhatsApp(phone) {
    const normalized = normalizePhoneNumber(phone);
    // Brazilian numbers (10 or 11 digits): add 55 if missing
    if ((normalized.length === 10 || normalized.length === 11) && !normalized.startsWith('55')) {
        return '55' + normalized;
    }
    return normalized;
}
/**
 * Normalize phone number for Socket.io room names
 *
 * Ensures consistent room naming across server and client by removing
 * WhatsApp JID suffixes and device IDs, then normalizing to include country code.
 *
 * @param phone - Phone number in any format (e.g., "5511999999999@s.whatsapp.net", "11999999999", "5511999999999:1@s.whatsapp.net")
 * @returns Normalized phone number with country code (e.g., "5511999999999")
 *
 * @example
 * normalizePhoneForSocket("5511999999999@s.whatsapp.net") // "5511999999999"
 * normalizePhoneForSocket("11999999999") // "5511999999999"
 * normalizePhoneForSocket("5511999999999:1@s.whatsapp.net") // "5511999999999"
 */
function normalizePhoneForSocket(phone) {
    if (!phone)
        return '';
    // Remove WhatsApp JID suffixes (@s.whatsapp.net, @c.us)
    // Remove device ID suffix (e.g., :1, :2)
    let normalized = phone.split('@')[0].split(':')[0];
    // Remove all non-digit characters
    normalized = normalized.replace(/\D/g, '');
    // Add country code if missing (assume Brazil - 55)
    if (!normalized.startsWith('55') && normalized.length <= 11) {
        normalized = '55' + normalized;
    }
    return normalized;
}
