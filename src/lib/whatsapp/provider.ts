/**
 * WhatsApp Provider Switcher
 * 
 * Permite trocar entre whatsapp-web.js e Baileys via variável de ambiente
 * 
 * Configuração: WHATSAPP_PROVIDER=baileys | wwebjs (default: baileys)
 */

import {
    initializeBaileys,
    getBaileysStatus,
    sendBaileysMessage,
    isBaileysReady,
    restartBaileys,
    logoutBaileys,
    clearSession as clearBaileysSession,
    validateBaileysNumber,
    onBaileysMessage,
    getBaileysProfilePicture,
    baileysState
} from './baileys';

import type { WhatsAppStatusResponse, SendMessageResult } from './types';
import { whatsappLogger } from '@/lib/logger';

// Provider type
export type WhatsAppProvider = 'baileys' | 'wwebjs';

// Selected provider (can be overridden by UI)
let selectedProvider: WhatsAppProvider | null = null;

// Get current provider (priority: selectedProvider > env var > default)
export const getProvider = (): WhatsAppProvider => {
    // If user selected a provider via UI, use it
    if (selectedProvider) {
        return selectedProvider;
    }
    // Otherwise, check environment variable
    const envProvider = process.env.WHATSAPP_PROVIDER?.toLowerCase();
    if (envProvider === 'wwebjs') {
        return 'wwebjs';
    }
    return 'baileys'; // Default to Baileys
};

/**
 * Set the provider to use (called from UI)
 */
export function setProvider(provider: WhatsAppProvider): void {
    selectedProvider = provider;
    whatsappLogger.info(`Provider set to: ${provider}`);
}

// Global state tracking
let currentProvider: WhatsAppProvider | null = null;

/**
 * Initialize WhatsApp client using configured or specified provider
 * @param providerOverride Optional provider to use (overrides current selection)
 */
export async function initializeWhatsApp(providerOverride?: WhatsAppProvider): Promise<void> {
    // If override provided, save it as selected
    if (providerOverride) {
        setProvider(providerOverride);
    }

    const provider = getProvider();
    currentProvider = provider;

    whatsappLogger.info(`Initializing WhatsApp with provider: ${provider}`);

    if (provider === 'baileys') {
        await initializeBaileys();
    } else {
        // Import whatsapp-web.js implementation dynamically to avoid loading when not needed
        const { getClient } = await import('./index');
        getClient();
    }
}

/**
 * Get current connection status
 */
export async function getWhatsAppStatus(): Promise<WhatsAppStatusResponse> {
    const provider = getProvider();

    if (provider === 'baileys') {
        return getBaileysStatus();
    } else {
        const { getStatus } = await import('./index');
        return getStatus();
    }
}

/**
 * Check if client is ready
 */
export async function isWhatsAppReady(): Promise<boolean> {
    const provider = getProvider();

    if (provider === 'baileys') {
        return isBaileysReady();
    } else {
        const { isClientReady } = await import('./index');
        return isClientReady();
    }
}

/**
 * Send a message
 */
export async function sendWhatsAppMessage(
    phone: string,
    message: string,
    mediaUrl?: string,
    mediaType?: string
): Promise<SendMessageResult> {
    const provider = getProvider();

    if (provider === 'baileys') {
        return sendBaileysMessage(phone, message, mediaUrl);
    } else {
        const { sendMessage } = await import('./index');
        return sendMessage(phone, message, mediaUrl, mediaType);
    }
}

/**
 * Get profile picture URL
 */
export async function getContactProfilePicture(phone: string): Promise<string | null> {
    const provider = getProvider();

    if (provider === 'baileys') {
        return getBaileysProfilePicture(phone);
    } else {
        const { getContactProfilePicture: getPic } = await import('./index');
        return getPic(phone);
    }
}

/**
 * Validate WhatsApp number
 */
export async function validateWhatsAppNumber(phone: string): Promise<string | null> {
    const provider = getProvider();

    if (provider === 'baileys') {
        return validateBaileysNumber(phone);
    } else {
        const { validateWhatsAppNumber: validate } = await import('./index');
        return validate(phone);
    }
}

/**
 * Restart client
 */
export async function restartWhatsApp(): Promise<void> {
    const provider = getProvider();

    if (provider === 'baileys') {
        await restartBaileys();
    } else {
        const { restartClient } = await import('./index');
        await restartClient();
    }
}

/**
 * Logout
 */
export async function logoutWhatsApp(): Promise<void> {
    const provider = getProvider();

    if (provider === 'baileys') {
        await logoutBaileys();
    } else {
        const { logout } = await import('./index');
        await logout();
    }
}

/**
 * Reset session
 */
export async function resetWhatsAppSession(autoReconnect = true): Promise<void> {
    const provider = getProvider();

    if (provider === 'baileys') {
        await clearBaileysSession();
        if (autoReconnect) {
            await initializeBaileys();
        }
    } else {
        const { resetSession } = await import('./index');
        await resetSession(autoReconnect);
    }
}

/**
 * Register message handler
 */
export function onWhatsAppMessage(callback: (message: {
    from: string;
    body: string;
    isGroup: boolean;
    timestamp: Date;
    fromMe: boolean;
    id: string;
}) => void): void {
    const provider = getProvider();

    if (provider === 'baileys') {
        onBaileysMessage(callback);
    } else {
        // For wwebjs, messages are handled via event handlers in client.ts
        whatsappLogger.warn('Message callback not directly supported for wwebjs provider');
    }
}

/**
 * Get current provider being used
 */
export function getCurrentProvider(): WhatsAppProvider | null {
    return currentProvider;
}

// Export Baileys state for direct access when needed
export { baileysState };
