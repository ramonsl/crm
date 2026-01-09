/**
 * WhatsApp Module - Public Facade
 * 
 * This file is the main entry point for the WhatsApp module.
 * It provides a backwards-compatible API that matches the original whatsapp.ts,
 * while internally using the modular architecture.
 * 
 * Usage:
 * import { getClient, sendMessage, getStatus } from '@/lib/whatsapp';
 * 
 * Following:
 * - Facade Pattern: Single point of entry to complex subsystem
 * - DIP: Instantiates concrete implementations, exports abstractions
 */

import { state } from './state';
import { HealthCheckService } from './health';
import { WhatsAppValidator } from './validation';
import { WhatsAppMessenger } from './messaging';
import { WhatsAppGroups } from './groups';
import { WhatsAppClientManager } from './client';
import { MessageEventHandler } from './events/messageHandler';
import { WHATSAPP_CONFIG } from '../constants';

// ============================================================================
// SERVICE INSTANTIATION (Dependency Injection with Global Singleton)
// ============================================================================

// Declare global types for service instances
declare global {
    var whatsappHealthService: HealthCheckService | undefined;
    var whatsappValidator: WhatsAppValidator | undefined;
    var whatsappMessageHandler: MessageEventHandler | undefined;
    var whatsappClientManager: WhatsAppClientManager | undefined;
    var whatsappMessenger: WhatsAppMessenger | undefined;
    var whatsappGroups: WhatsAppGroups | undefined;
}

// Create instances with proper dependency injection, using global singletons
// This ensures the same instances are used across all module imports
if (!global.whatsappHealthService) {
    global.whatsappHealthService = new HealthCheckService(state, WHATSAPP_CONFIG);
}
if (!global.whatsappValidator) {
    global.whatsappValidator = new WhatsAppValidator(state);
}
if (!global.whatsappMessageHandler) {
    global.whatsappMessageHandler = new MessageEventHandler(state, true);
}
if (!global.whatsappClientManager) {
    global.whatsappClientManager = new WhatsAppClientManager(
        state,
        global.whatsappHealthService,
        global.whatsappMessageHandler
    );
}
if (!global.whatsappMessenger) {
    global.whatsappMessenger = new WhatsAppMessenger(state, global.whatsappHealthService);
}
if (!global.whatsappGroups) {
    global.whatsappGroups = new WhatsAppGroups(state);
}

// Export references for internal use
const healthService = global.whatsappHealthService;
const validator = global.whatsappValidator;
const messageHandler = global.whatsappMessageHandler;
const clientManager = global.whatsappClientManager;
const messenger = global.whatsappMessenger;
const groups = global.whatsappGroups;

// ============================================================================
// GRACEFUL SHUTDOWN HANDLER
// ============================================================================

/**
 * Handle graceful shutdown to preserve WhatsApp session
 */
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return; // Prevent multiple shutdowns
    isShuttingDown = true;

    console.log(`\n[WhatsApp] Received ${signal}. Closing client gracefully...`);

    if (state.client) {
        try {
            // Stop health check first
            healthService.stop();

            // Set a timeout in case destroy hangs
            const destroyPromise = state.client.destroy();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Destroy timeout')), 5000)
            );

            await Promise.race([destroyPromise, timeoutPromise]);
            console.log('[WhatsApp] Client closed successfully. Session preserved.');
        } catch (error) {
            console.error('[WhatsApp] Error closing client:', error);
        }
    } else {
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
            'ECONNRESET',                         // Connection reset by peer
            'ETIMEDOUT',                          // Connection timeout
            'ENOTFOUND',                          // DNS lookup failed
            'ECONNREFUSED',                       // Connection refused
            'Client has already been connected',  // Duplicate connection attempt
        ];

        const isRecoverable = RECOVERABLE_ERROR_PATTERNS.some(pattern =>
            errorMessage.includes(pattern)
        );

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

// Add to global types
declare global {
    var whatsappShutdownRegistered: boolean | undefined;
}

// ============================================================================
// PUBLIC API - Backwards Compatible Exports
// ============================================================================

/**
 * Get or initialize the WhatsApp client
 * @returns The WhatsApp Client instance
 */
export const getClient = () => clientManager.initialize();

/**
 * Get current WhatsApp connection status
 * @returns Status object with status, qrCode, and phoneNumber
 */
export const getStatus = () => clientManager.getStatus();

/**
 * Check if the WhatsApp client is ready to send messages
 * @returns Promise resolving to true if ready
 */
export const isClientReady = () => clientManager.isReady();

/**
 * Restart the WhatsApp client
 */
export const restartClient = () => clientManager.restart();

/**
 * Logout from WhatsApp (preserves session data)
 */
export const logout = () => clientManager.logout();

/**
 * Reset session (deletes auth data, requires new QR scan)
 * @param autoReconnect Whether to auto-reconnect after reset
 */
export const resetSession = (autoReconnect?: boolean) => clientManager.resetSession(autoReconnect);

/**
 * Validate if a phone number is registered on WhatsApp
 * @param phone Phone number to validate
 * @returns Promise with WhatsApp ID if valid, null otherwise
 */
export const validateWhatsAppNumber = (phone: string) => validator.validate(phone);

/**
 * Get profile picture URL for a contact
 * @param phone Phone number
 * @returns Promise with URL or null
 */
export const getContactProfilePicture = (phone: string) => validator.getProfilePicture(phone);

/**
 * Send a message to a phone number
 * @param phone Target phone number
 * @param message Message text
 * @param mediaUrl Optional media URL
 * @param mediaType Optional media type hint
 */
export const sendMessage = (
    phone: string,
    message: string,
    mediaUrl?: string,
    mediaType?: string
) => messenger.send(phone, message, { mediaUrl, mediaType });

/**
 * Check if a phone number is in a specific group
 * @param phone Phone number to check
 * @param groupId Group ID or name
 */
export const isNumberInGroup = (phone: string, groupId: string) =>
    groups.isNumberInGroup(phone, groupId);

/**
 * List all WhatsApp groups
 */
export const listAllGroups = () => groups.listAll();

/**
 * Get participants of a group
 * @param groupId Group ID or name
 */
export const getGroupParticipants = (groupId: string) => groups.getParticipants(groupId);

/**
 * Handle incoming message event (exposed for external registration)
 * @param msg WhatsApp message object
 */
export const handleMessageCreate = (msg: any) => messageHandler.handle(msg);

// ============================================================================
// EXPORTS FOR ADVANCED USAGE
// ============================================================================

// Export service instances for advanced usage
export { state, validator, messenger, groups, clientManager, healthService };

// Export types
export type {
    WhatsAppStatus,
    WhatsAppStatusResponse,
    SendMessageOptions,
    SendMessageResult,
    GroupInfo,
    GroupParticipant,
} from './types';

// Export classes for testing or extension
export { WhatsAppStateManager } from './state';
export { WhatsAppValidator } from './validation';
export { WhatsAppMessenger } from './messaging';
export { WhatsAppGroups } from './groups';
export { WhatsAppClientManager } from './client';
export { HealthCheckService } from './health';
export { MessageEventHandler } from './events/messageHandler';
