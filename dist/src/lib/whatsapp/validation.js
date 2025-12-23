"use strict";
/**
 * WhatsApp Validator - Phone Number Validation & Profile Pictures
 *
 * Centralizes all phone number normalization, validation, and profile picture fetching.
 * Extracted from the original whatsapp.ts to follow Single Responsibility Principle.
 *
 * Following:
 * - SRP: Only handles validation logic
 * - DIP: Depends on state abstraction, not concrete globals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppValidator = void 0;
const logger_1 = require("../../lib/logger");
class WhatsAppValidator {
    constructor(state) {
        this.state = state;
    }
    /**
     * Normalize a phone number (remove non-digits, add country code if needed)
     */
    normalizePhone(phone) {
        let formatted = phone.replace(/\D/g, '');
        // Remove leading 0 if present
        if (formatted.startsWith('0')) {
            formatted = formatted.substring(1);
        }
        // Add Brazil country code if it's a local number (10 or 11 digits)
        if (formatted.length === 10 || formatted.length === 11) {
            formatted = '55' + formatted;
        }
        return formatted;
    }
    /**
     * Get all phone number variations for Brazilian numbers
     * (with/without 9th digit)
     */
    getPhoneVariations(phone) {
        const formatted = this.normalizePhone(phone);
        const variations = [formatted];
        // For Brazilian numbers, try with and without the 9th digit
        if (formatted.startsWith('55') && formatted.length === 13) {
            // Has 9th digit, try without it
            const without9 = formatted.substring(0, 4) + formatted.substring(5);
            variations.push(without9);
        }
        else if (formatted.startsWith('55') && formatted.length === 12) {
            // Doesn't have 9th digit, try with it
            const with9 = formatted.substring(0, 4) + '9' + formatted.substring(4);
            variations.push(with9);
        }
        return variations;
    }
    /**
     * Helper to timeout promises
     */
    withTimeout(promise, timeoutMs, errorMsg) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
        ]);
    }
    /**
     * Validate if a phone number is registered on WhatsApp
     * Returns the serialized WhatsApp ID if valid, null otherwise
     */
    async validate(phone) {
        if (!this.state.isClientAvailable()) {
            logger_1.whatsappLogger.debug('⚠️ Client not available for validation');
            return null;
        }
        // Additional safety check: ensure client is not null
        if (!this.state.client) {
            logger_1.whatsappLogger.debug('⚠️ Client is null, cannot validate');
            return null;
        }
        const formattedPhone = this.normalizePhone(phone);
        try {
            let registeredUser = null;
            logger_1.whatsappLogger.debug(` Validating number: ${formattedPhone}`);
            // Special handling for Brazil
            if (formattedPhone.startsWith('55')) {
                // Case A: Input has 13 digits (e.g. 55 51 9 8888 8888)
                if (formattedPhone.length === 13) {
                    // Try 12 digits FIRST (remove 9)
                    const phoneWithout9 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
                    logger_1.whatsappLogger.debug(` Validation: Trying 12-digit version first: +${phoneWithout9}`);
                    try {
                        registeredUser = await this.withTimeout(this.state.client.getNumberId(`+${phoneWithout9}`), 5000, 'Timeout checking 12-digit');
                    }
                    catch (e) {
                        const errorMsg = e instanceof Error ? e.message : String(e);
                        logger_1.whatsappLogger.warn(` 12-digit lookup failed: ${errorMsg}`);
                        // Continue to try other variations even on Puppeteer errors
                    }
                    // If found, great! If not, try original 13 digits
                    if (registeredUser) {
                        logger_1.whatsappLogger.debug(` Validation: Found on 12-digit: ${registeredUser._serialized}`);
                        return registeredUser._serialized;
                    }
                    else {
                        logger_1.whatsappLogger.debug(` Validation: 12-digit failed, trying original 13-digit: +${formattedPhone}`);
                        try {
                            registeredUser = await this.withTimeout(this.state.client.getNumberId(`+${formattedPhone}`), 5000, 'Timeout checking 13-digit');
                        }
                        catch (e) {
                            const errorMsg = e instanceof Error ? e.message : String(e);
                            logger_1.whatsappLogger.warn(` 13-digit lookup failed: ${errorMsg}`);
                            // Continue to try other variations even on Puppeteer errors
                        }
                    }
                }
                // Case B: Input has 12 digits (e.g. 55 51 8888 8888)
                else if (formattedPhone.length === 12) {
                    // Try 12 digits FIRST (as is)
                    logger_1.whatsappLogger.debug(` Validation: Trying 12-digit version first: +${formattedPhone}`);
                    try {
                        registeredUser = await this.withTimeout(this.state.client.getNumberId(`+${formattedPhone}`), 5000, 'Timeout checking 12-digit');
                    }
                    catch (e) {
                        const errorMsg = e instanceof Error ? e.message : String(e);
                        logger_1.whatsappLogger.warn(` 12-digit lookup failed: ${errorMsg}`);
                        // Continue trying other variations
                    }
                    // If found, great! If not, try adding 9
                    if (registeredUser) {
                        logger_1.whatsappLogger.debug(` Validation: Found on 12-digit: ${registeredUser._serialized}`);
                        return registeredUser._serialized;
                    }
                    else {
                        const phoneWith9 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
                        logger_1.whatsappLogger.debug(` Validation: 12-digit failed, trying 13-digit (add 9): +${phoneWith9}`);
                        try {
                            registeredUser = await this.withTimeout(this.state.client.getNumberId(`+${phoneWith9}`), 5000, 'Timeout checking 13-digit');
                        }
                        catch (e) {
                            const errorMsg = e instanceof Error ? e.message : String(e);
                            logger_1.whatsappLogger.warn(` 13-digit lookup failed: ${errorMsg}`);
                            if (errorMsg.includes('Evaluation failed') ||
                                errorMsg.includes('Cannot read properties of undefined')) {
                                logger_1.whatsappLogger.error('⚠️ Critical browser context error during validation');
                                return null;
                            }
                        }
                    }
                }
                // Other lengths (e.g. landlines), just try as is
                else {
                    try {
                        registeredUser = await this.withTimeout(this.state.client.getNumberId(`+${formattedPhone}`), 5000, 'Timeout checking registration');
                    }
                    catch (e) {
                        logger_1.whatsappLogger.warn(` Lookup failed: ${e}`);
                    }
                }
            }
            // International numbers
            else {
                // Attempt 1: With '+'
                const lookupPhonePlus = `+${formattedPhone}`;
                try {
                    registeredUser = await this.withTimeout(this.state.client.getNumberId(lookupPhonePlus), 5000, 'Timeout checking number registration (+)');
                }
                catch (e) {
                    logger_1.whatsappLogger.warn(` Lookup with + failed: ${e}`);
                }
                // Attempt 2: Without '+'
                if (!registeredUser) {
                    try {
                        registeredUser = await this.withTimeout(this.state.client.getNumberId(formattedPhone), 5000, 'Timeout checking number registration (raw)');
                    }
                    catch (e) {
                        logger_1.whatsappLogger.warn(` Lookup raw failed: ${e}`);
                    }
                }
            }
            if (registeredUser) {
                logger_1.whatsappLogger.debug(` Validation: Found user: ${registeredUser._serialized}`);
                return registeredUser._serialized;
            }
        }
        catch (error) {
            logger_1.whatsappLogger.error('Error validating number:', error);
        }
        logger_1.whatsappLogger.debug(' Validation: No user found.');
        return null;
    }
    /**
     * Get contact profile picture URL
     */
    async getProfilePicture(phone) {
        logger_1.whatsappLogger.debug(` Attempting to get profile picture for ${phone}`);
        if (!this.state.isClientAvailable()) {
            logger_1.whatsappLogger.error(' Client not ready');
            return null;
        }
        try {
            const variations = this.getPhoneVariations(phone);
            logger_1.whatsappLogger.debug(` Trying variations for profile pic: ${variations.join(', ')}`);
            // Try each variation
            for (const phoneVariation of variations) {
                try {
                    const chatId = `${phoneVariation}@c.us`;
                    logger_1.whatsappLogger.debug(` Trying profile pic for chatId: ${chatId}`);
                    const profilePicUrl = await this.state.client.getProfilePicUrl(chatId);
                    if (profilePicUrl) {
                        logger_1.whatsappLogger.debug(` ✓ Profile picture found for ${phone} using ${phoneVariation}`);
                        return profilePicUrl;
                    }
                }
                catch (err) {
                    // Continue to next variation
                    logger_1.whatsappLogger.debug(` No picture with variation ${phoneVariation}`);
                }
            }
            logger_1.whatsappLogger.debug(` No profile picture available for ${phone} (tried all variations)`);
            return null;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.whatsappLogger.debug(` Could not get profile picture for ${phone}: ${errorMessage}`);
            return null;
        }
    }
}
exports.WhatsAppValidator = WhatsAppValidator;
