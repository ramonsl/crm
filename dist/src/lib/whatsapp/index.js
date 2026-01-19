"use strict";
/**
 * WhatsApp Module - Public Facade
 *
 * This file is the main entry point for the WhatsApp module.
 * It provides a backwards-compatible API that matches the original whatsapp.ts,
 * while internally using the modular architecture.
 *
 * Usage:
 * import { getClient, sendMessage, getStatus } from '../../lib/whatsapp';
 *
 * Following:
 * - Facade Pattern: Single point of entry to complex subsystem
 * - DIP: Instantiates concrete implementations, exports abstractions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageEventHandler = exports.HealthCheckService = exports.WhatsAppClientManager = exports.WhatsAppGroups = exports.WhatsAppMessenger = exports.WhatsAppValidator = exports.WhatsAppStateManager = exports.healthService = exports.clientManager = exports.groups = exports.messenger = exports.validator = exports.state = exports.handleMessageCreate = exports.getGroupParticipants = exports.listAllGroups = exports.isNumberInGroup = exports.sendMessage = exports.getContactProfilePicture = exports.validateWhatsAppNumber = exports.resetSession = exports.logout = exports.restartClient = exports.isClientReady = exports.getStatus = exports.getClient = void 0;
const state_1 = require("./state");
Object.defineProperty(exports, "state", { enumerable: true, get: function () { return state_1.state; } });
const health_1 = require("./health");
const validation_1 = require("./validation");
const messaging_1 = require("./messaging");
const groups_1 = require("./groups");
const client_1 = require("./client");
const messageHandler_1 = require("./events/messageHandler");
const constants_1 = require("../constants");
// Create instances with proper dependency injection, using global singletons
// This ensures the same instances are used across all module imports
if (!global.whatsappHealthService) {
    global.whatsappHealthService = new health_1.HealthCheckService(state_1.state, constants_1.WHATSAPP_CONFIG);
}
if (!global.whatsappValidator) {
    global.whatsappValidator = new validation_1.WhatsAppValidator(state_1.state);
}
if (!global.whatsappMessageHandler) {
    global.whatsappMessageHandler = new messageHandler_1.MessageEventHandler(state_1.state, true);
}
if (!global.whatsappClientManager) {
    global.whatsappClientManager = new client_1.WhatsAppClientManager(state_1.state, global.whatsappHealthService, global.whatsappMessageHandler);
}
if (!global.whatsappMessenger) {
    global.whatsappMessenger = new messaging_1.WhatsAppMessenger(state_1.state, global.whatsappHealthService);
}
if (!global.whatsappGroups) {
    global.whatsappGroups = new groups_1.WhatsAppGroups(state_1.state);
}
// Export references for internal use
const healthService = global.whatsappHealthService;
exports.healthService = healthService;
const validator = global.whatsappValidator;
exports.validator = validator;
const messageHandler = global.whatsappMessageHandler;
const clientManager = global.whatsappClientManager;
exports.clientManager = clientManager;
const messenger = global.whatsappMessenger;
exports.messenger = messenger;
const groups = global.whatsappGroups;
exports.groups = groups;
// ============================================================================
// GRACEFUL SHUTDOWN HANDLER
// ============================================================================
/**
 * Handle graceful shutdown to preserve WhatsApp session
 */
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
    if (isShuttingDown)
        return; // Prevent multiple shutdowns
    isShuttingDown = true;
    console.log(`\n[WhatsApp] Received ${signal}. Closing client gracefully...`);
    if (state_1.state.client) {
        try {
            // Stop health check first
            healthService.stop();
            // Set a timeout in case destroy hangs
            const destroyPromise = state_1.state.client.destroy();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Destroy timeout')), 5000));
            await Promise.race([destroyPromise, timeoutPromise]);
            console.log('[WhatsApp] Client closed successfully. Session preserved.');
        }
        catch (error) {
            console.error('[WhatsApp] Error closing client:', error);
        }
    }
    else {
        console.log('[WhatsApp] No active client to close.');
    }
    // Exit process
    console.log('[WhatsApp] Exiting...');
    process.exit(0);
};
// Register shutdown handlers (only once)
if (!global.whatsappShutdownRegistered) {
    global.whatsappShutdownRegistered = true;
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    // Handle uncaught exceptions to try to save session
    // Filter recoverable errors (e.g., database connection issues) from critical errors
    process.on('uncaughtException', async (error) => {
        const errorMessage = error.message || '';
        // Errors that should NOT crash the entire application
        const RECOVERABLE_ERROR_PATTERNS = [
            'Connection terminated unexpectedly', // Neon WebSocket disconnection
            'ECONNRESET', // Connection reset by peer
            'ETIMEDOUT', // Connection timeout
            'ENOTFOUND', // DNS lookup failed
            'ECONNREFUSED', // Connection refused
            'Client has already been connected', // Duplicate connection attempt
        ];
        const isRecoverable = RECOVERABLE_ERROR_PATTERNS.some(pattern => errorMessage.includes(pattern));
        if (isRecoverable) {
            // Log the error but DO NOT crash the application
            console.error('[WhatsApp] Recoverable error caught (not crashing):', {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            return; // Continue running
        }
        // Critical error - perform graceful shutdown
        console.error('[WhatsApp] Critical uncaught exception:', error);
        await gracefulShutdown('uncaughtException');
    });
}
// ============================================================================
// PUBLIC API - Backwards Compatible Exports
// ============================================================================
/**
 * Get or initialize the WhatsApp client
 * @returns The WhatsApp Client instance
 */
const getClient = () => clientManager.initialize();
exports.getClient = getClient;
/**
 * Get current WhatsApp connection status
 * @returns Status object with status, qrCode, and phoneNumber
 */
const getStatus = () => clientManager.getStatus();
exports.getStatus = getStatus;
/**
 * Check if the WhatsApp client is ready to send messages
 * @returns Promise resolving to true if ready
 */
const isClientReady = () => clientManager.isReady();
exports.isClientReady = isClientReady;
/**
 * Restart the WhatsApp client
 */
const restartClient = () => clientManager.restart();
exports.restartClient = restartClient;
/**
 * Logout from WhatsApp (preserves session data)
 */
const logout = () => clientManager.logout();
exports.logout = logout;
/**
 * Reset session (deletes auth data, requires new QR scan)
 * @param autoReconnect Whether to auto-reconnect after reset
 */
const resetSession = (autoReconnect) => clientManager.resetSession(autoReconnect);
exports.resetSession = resetSession;
/**
 * Validate if a phone number is registered on WhatsApp
 * @param phone Phone number to validate
 * @returns Promise with WhatsApp ID if valid, null otherwise
 */
const validateWhatsAppNumber = (phone) => validator.validate(phone);
exports.validateWhatsAppNumber = validateWhatsAppNumber;
/**
 * Get profile picture URL for a contact
 * @param phone Phone number
 * @returns Promise with URL or null
 */
const getContactProfilePicture = (phone) => validator.getProfilePicture(phone);
exports.getContactProfilePicture = getContactProfilePicture;
/**
 * Send a message to a phone number
 * @param phone Target phone number
 * @param message Message text
 * @param mediaUrl Optional media URL
 * @param mediaType Optional media type hint
 */
const sendMessage = (phone, message, mediaUrl, mediaType) => messenger.send(phone, message, { mediaUrl, mediaType });
exports.sendMessage = sendMessage;
/**
 * Check if a phone number is in a specific group
 * @param phone Phone number to check
 * @param groupId Group ID or name
 */
const isNumberInGroup = (phone, groupId) => groups.isNumberInGroup(phone, groupId);
exports.isNumberInGroup = isNumberInGroup;
/**
 * List all WhatsApp groups
 */
const listAllGroups = () => groups.listAll();
exports.listAllGroups = listAllGroups;
/**
 * Get participants of a group
 * @param groupId Group ID or name
 */
const getGroupParticipants = (groupId) => groups.getParticipants(groupId);
exports.getGroupParticipants = getGroupParticipants;
/**
 * Handle incoming message event (exposed for external registration)
 * @param msg WhatsApp message object
 */
const handleMessageCreate = (msg) => messageHandler.handle(msg);
exports.handleMessageCreate = handleMessageCreate;
// Export classes for testing or extension
var state_2 = require("./state");
Object.defineProperty(exports, "WhatsAppStateManager", { enumerable: true, get: function () { return state_2.WhatsAppStateManager; } });
var validation_2 = require("./validation");
Object.defineProperty(exports, "WhatsAppValidator", { enumerable: true, get: function () { return validation_2.WhatsAppValidator; } });
var messaging_2 = require("./messaging");
Object.defineProperty(exports, "WhatsAppMessenger", { enumerable: true, get: function () { return messaging_2.WhatsAppMessenger; } });
var groups_2 = require("./groups");
Object.defineProperty(exports, "WhatsAppGroups", { enumerable: true, get: function () { return groups_2.WhatsAppGroups; } });
var client_2 = require("./client");
Object.defineProperty(exports, "WhatsAppClientManager", { enumerable: true, get: function () { return client_2.WhatsAppClientManager; } });
var health_2 = require("./health");
Object.defineProperty(exports, "HealthCheckService", { enumerable: true, get: function () { return health_2.HealthCheckService; } });
var messageHandler_2 = require("./events/messageHandler");
Object.defineProperty(exports, "MessageEventHandler", { enumerable: true, get: function () { return messageHandler_2.MessageEventHandler; } });
