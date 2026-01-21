/**
 * WhatsApp Provider Wrapper (Adapter Pattern)
 * 
 * Ensures compatibility with existing code that imports from 'provider.ts'
 * while delegating all logic to the singleton WhatsAppProviderFactory.
 */

import { WhatsAppProviderFactory, ProviderType } from './factory/WhatsAppProviderFactory';
import { whatsappLogger } from '@/lib/logger';
import type { WhatsAppStatusResponse, SendMessageResult } from './IWhatsAppProvider';

// Re-export types for compatibility
export type WhatsAppProvider = ProviderType;
export type { WhatsAppStatusResponse, SendMessageResult };

/**
 * Initialize WhatsApp client using factory
 */
export async function initializeWhatsApp(providerOverride?: any): Promise<void> {
    const provider = await WhatsAppProviderFactory.getProvider();
    await provider.initialize();
}

/**
 * Get current connection status
 */
export async function getWhatsAppStatus(): Promise<WhatsAppStatusResponse> {
    const provider = await WhatsAppProviderFactory.getProvider();
    return provider.getStatus();
}

/**
 * Check if client is ready
 */
export async function isWhatsAppReady(): Promise<boolean> {
    const provider = await WhatsAppProviderFactory.getProvider();
    return provider.isReady();
}

/**
 * Send a message
 */
export async function sendWhatsAppMessage(
    phone: string,
    message: string,
    mediaUrl?: string,
    mediaType?: any
): Promise<SendMessageResult> {
    const provider = await WhatsAppProviderFactory.getProvider();
    const providerName = provider.getProviderName();
    const isReady = await provider.isReady();
    const status = await provider.getStatus();

    whatsappLogger.info(`[sendWhatsAppMessage] Provider: ${providerName}, Ready: ${isReady}, Status: ${status.status}`);

    if (!isReady) {
        whatsappLogger.warn(`[sendWhatsAppMessage] Provider not ready! Status: ${status.status}`);
        return {
            success: false,
            error: `WhatsApp não está pronto (Status: ${status.status})`
        };
    }

    return provider.sendMessage(phone, message, mediaUrl, mediaType);
}

/**
 * Get profile picture URL
 */
export async function getContactProfilePicture(phone: string): Promise<string | null> {
    const provider = await WhatsAppProviderFactory.getProvider();
    return provider.getProfilePicture(phone);
}

/**
 * Validate WhatsApp number
 */
export async function validateWhatsAppNumber(phone: string): Promise<string | null> {
    const provider = await WhatsAppProviderFactory.getProvider();
    return provider.validateNumber(phone);
}

/**
 * Restart client
 */
export async function restartWhatsApp(): Promise<void> {
    const provider = await WhatsAppProviderFactory.getProvider();
    await provider.restart();
}

/**
 * Logout
 */
export async function logoutWhatsApp(): Promise<void> {
    const provider = await WhatsAppProviderFactory.getProvider();
    await provider.logout();
}

/**
 * Reset session
 */
export async function resetWhatsAppSession(autoReconnect = true): Promise<void> {
    const provider = await WhatsAppProviderFactory.getProvider();
    await provider.clearSession(autoReconnect);
}

/**
 * Register message handler
 */
export function onWhatsAppMessage(callback: (message: any) => void): void {
    WhatsAppProviderFactory.getProvider().then(provider => {
        provider.onMessage(callback);
    });
}

/**
 * Get current provider name
 */
export function getCurrentProvider(): string | null {
    return 'active-provider';
}

// Export specific Baileys functions that might be imported by legacy code (mock them via Factory)
export async function initializeBaileys() { return initializeWhatsApp(); }
export async function getBaileysStatus() { return getWhatsAppStatus(); }
export async function sendBaileysMessage(p: string, m: string, u?: string) { return sendWhatsAppMessage(p, m, u); }
export async function restartBaileys() { return restartWhatsApp(); }
export async function logoutBaileys() { return logoutWhatsApp(); }
export async function clearSession() { return resetWhatsAppSession(); }
export async function validateBaileysNumber(p: string) { return validateWhatsAppNumber(p); }
export async function getBaileysProfilePicture(p: string) { return getContactProfilePicture(p); }

// Legacy aliases expected by some tests
export async function sendMessage(p: string, m: string, u?: string, t?: any) { return sendWhatsAppMessage(p, m, u, t); }
export async function getStatus() { return getWhatsAppStatus(); }
export async function initialize(o?: any) { return initializeWhatsApp(o); }
export async function isReady() { return isWhatsAppReady(); }
