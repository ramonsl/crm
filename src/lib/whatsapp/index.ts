/**
 * WhatsApp Module - Public Facade (Legacy Compatibility Layer)
 * 
 * This file provides backward compatibility for the existing codebase
 * while redirecting all calls to the new Provider Switcher architecture.
 * 
 * It replaces the old dependency injection and class instantiation
 * to prevent legacy WWebJS/Puppeteer from starting up.
 */

import {
    initializeWhatsApp,
    getWhatsAppStatus,
    sendWhatsAppMessage,
    logoutWhatsApp,
    resetWhatsAppSession,
    validateWhatsAppNumber as providerValidate,
    getContactProfilePicture as providerGetProfilePic
} from './provider';

// Re-export types for compatibility
export * from './types';

/**
 * Get or initialize the WhatsApp client
 * Redistributes to provider.ts
 */
export const getClient = async () => {
    await initializeWhatsApp();
    // Return a mock client object for legacy code that expects it
    // Most code just calls getClient() without using the return value
    return {
        destroy: logoutWhatsApp,
        logout: logoutWhatsApp,
        initialize: initializeWhatsApp,
        getChats: async () => [],
        getChatById: async (id: string) => null,
        on: (event: string, cb: any) => { },
    };
};

/**
 * Get current WhatsApp connection status
 */
export const getStatus = async () => {
    return await getWhatsAppStatus();
};

/**
 * Check if the WhatsApp client is ready to send messages
 */
export const isClientReady = async () => {
    const status = await getWhatsAppStatus();
    return status.status === 'ready';
};

/**
 * Restart the WhatsApp client
 */
export const restartClient = async () => {
    await logoutWhatsApp();
    await initializeWhatsApp();
};

/**
 * Logout from WhatsApp
 */
export const logout = async () => {
    await logoutWhatsApp();
};

/**
 * Reset session
 */
export const resetSession = async (autoReconnect?: boolean) => {
    await resetWhatsAppSession();
    if (autoReconnect) {
        await initializeWhatsApp();
    }
};

/**
 * Validate if a phone number is registered on WhatsApp
 */
export const validateWhatsAppNumber = async (phone: string) => {
    const result = await providerValidate(phone);
    return result; // Provider returns string | null, which matches legacy
};

/**
 * Get profile picture URL for a contact
 */
export const getContactProfilePicture = async (phone: string) => {
    return await providerGetProfilePic(phone);
};

/**
 * Send a message to a phone number
 */
export const sendMessage = async (
    phone: string,
    message: string,
    mediaUrl?: string,
    mediaType?: string
) => {
    // Media type handling is simplified in provider
    return await sendWhatsAppMessage(phone, message, mediaUrl);
};

// ============================================================================
// STUBS FOR UNIMPLEMENTED LEGACY FUNCTIONS
// These functions might not be fully supported in the new provider yet
// ============================================================================

export const isNumberInGroup = async (phone: string, groupId: string) => {
    console.warn('[WhatsApp Legacy] isNumberInGroup not implemented in new provider');
    return false;
};

export const listAllGroups = async () => {
    console.warn('[WhatsApp Legacy] listAllGroups not implemented in new provider');
    return [];
};

export const getGroupParticipants = async (groupId: string) => {
    console.warn('[WhatsApp Legacy] getGroupParticipants not implemented in new provider');
    return [];
};

export const handleMessageCreate = async (msg: any) => {
    // This is handled internally by the providers
    console.warn('[WhatsApp Legacy] handleMessageCreate is deprecated');
};

// Mock objects for direct import (state, validator, etc)
// accessible but non-functional to prevent runtime crashes
export const state = {
    status: 'disconnected',
    qrCode: null,
    client: null
};

// Deprecated instances
export const validator = { validate: validateWhatsAppNumber, getProfilePicture: getContactProfilePicture };
export const messenger = { send: sendMessage };
export const clientManager = { initialize: getClient, getStatus, isReady: isClientReady, restart: restartClient, logout, resetSession };
export const groups = { isNumberInGroup, listAllGroups, getParticipants: getGroupParticipants };
export const healthService = { stop: () => { }, start: () => { } };
