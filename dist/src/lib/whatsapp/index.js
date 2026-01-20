"use strict";
/**
 * WhatsApp Module - Public Facade (Legacy Compatibility Layer)
 *
 * This file provides backward compatibility for the existing codebase
 * while redirecting all calls to the new Provider Switcher architecture.
 *
 * It replaces the old dependency injection and class instantiation
 * to prevent legacy WWebJS/Puppeteer from starting up.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthService = exports.groups = exports.clientManager = exports.messenger = exports.validator = exports.state = exports.handleMessageCreate = exports.getGroupParticipants = exports.listAllGroups = exports.isNumberInGroup = exports.sendMessage = exports.getContactProfilePicture = exports.validateWhatsAppNumber = exports.resetSession = exports.logout = exports.restartClient = exports.isClientReady = exports.getStatus = exports.getClient = void 0;
const provider_1 = require("./provider");
// Re-export types for compatibility
__exportStar(require("./types"), exports);
/**
 * Get or initialize the WhatsApp client
 * Redistributes to provider.ts
 */
const getClient = async () => {
    await (0, provider_1.initializeWhatsApp)();
    // Return a mock client object for legacy code that expects it
    // Most code just calls getClient() without using the return value
    return {
        destroy: provider_1.logoutWhatsApp,
        logout: provider_1.logoutWhatsApp,
        initialize: provider_1.initializeWhatsApp,
        getChats: async () => [],
        getChatById: async (id) => null,
        on: (event, cb) => { },
    };
};
exports.getClient = getClient;
/**
 * Get current WhatsApp connection status
 */
const getStatus = async () => {
    return await (0, provider_1.getWhatsAppStatus)();
};
exports.getStatus = getStatus;
/**
 * Check if the WhatsApp client is ready to send messages
 */
const isClientReady = async () => {
    const status = await (0, provider_1.getWhatsAppStatus)();
    return status.status === 'ready';
};
exports.isClientReady = isClientReady;
/**
 * Restart the WhatsApp client
 */
const restartClient = async () => {
    await (0, provider_1.logoutWhatsApp)();
    await (0, provider_1.initializeWhatsApp)();
};
exports.restartClient = restartClient;
/**
 * Logout from WhatsApp
 */
const logout = async () => {
    await (0, provider_1.logoutWhatsApp)();
};
exports.logout = logout;
/**
 * Reset session
 */
const resetSession = async (autoReconnect) => {
    await (0, provider_1.resetWhatsAppSession)();
    if (autoReconnect) {
        await (0, provider_1.initializeWhatsApp)();
    }
};
exports.resetSession = resetSession;
/**
 * Validate if a phone number is registered on WhatsApp
 */
const validateWhatsAppNumber = async (phone) => {
    const result = await (0, provider_1.validateWhatsAppNumber)(phone);
    return result; // Provider returns string | null, which matches legacy
};
exports.validateWhatsAppNumber = validateWhatsAppNumber;
/**
 * Get profile picture URL for a contact
 */
const getContactProfilePicture = async (phone) => {
    return await (0, provider_1.getContactProfilePicture)(phone);
};
exports.getContactProfilePicture = getContactProfilePicture;
/**
 * Send a message to a phone number
 */
const sendMessage = async (phone, message, mediaUrl, mediaType) => {
    // Media type handling is simplified in provider
    return await (0, provider_1.sendWhatsAppMessage)(phone, message, mediaUrl);
};
exports.sendMessage = sendMessage;
// ============================================================================
// STUBS FOR UNIMPLEMENTED LEGACY FUNCTIONS
// These functions might not be fully supported in the new provider yet
// ============================================================================
const isNumberInGroup = async (phone, groupId) => {
    console.warn('[WhatsApp Legacy] isNumberInGroup not implemented in new provider');
    return false;
};
exports.isNumberInGroup = isNumberInGroup;
const listAllGroups = async () => {
    console.warn('[WhatsApp Legacy] listAllGroups not implemented in new provider');
    return [];
};
exports.listAllGroups = listAllGroups;
const getGroupParticipants = async (groupId) => {
    console.warn('[WhatsApp Legacy] getGroupParticipants not implemented in new provider');
    return [];
};
exports.getGroupParticipants = getGroupParticipants;
const handleMessageCreate = async (msg) => {
    // This is handled internally by the providers
    console.warn('[WhatsApp Legacy] handleMessageCreate is deprecated');
};
exports.handleMessageCreate = handleMessageCreate;
// Mock objects for direct import (state, validator, etc)
// accessible but non-functional to prevent runtime crashes
exports.state = {
    status: 'disconnected',
    qrCode: null,
    client: null
};
// Deprecated instances
exports.validator = { validate: exports.validateWhatsAppNumber, getProfilePicture: exports.getContactProfilePicture };
exports.messenger = { send: exports.sendMessage };
exports.clientManager = { initialize: exports.getClient, getStatus: exports.getStatus, isReady: exports.isClientReady, restart: exports.restartClient, logout: exports.logout, resetSession: exports.resetSession };
exports.groups = { isNumberInGroup: exports.isNumberInGroup, listAllGroups: exports.listAllGroups, getParticipants: exports.getGroupParticipants };
exports.healthService = { stop: () => { }, start: () => { } };
