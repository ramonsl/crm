/**
 * WhatsApp State Manager - Singleton
 * 
 * Encapsulates all global state for the WhatsApp client.
 * Replaces the scattered global.whatsapp* variables with a
 * type-safe, centralized state manager.
 * 
 * Following:
 * - Single Responsibility Principle (SRP): Only manages state
 * - Open/Closed Principle (OCP): Extensible via getters/setters
 */

import { Client } from 'whatsapp-web.js';
import type { WhatsAppStatus, WhatsAppClientState, WhatsAppStatusResponse } from './types';

// ============================================================================
// GLOBAL TYPE DECLARATIONS (for backwards compatibility)
// These allow existing code to use global.whatsappClient etc.
// ============================================================================

declare global {
    var whatsappClient: Client | null;
    var whatsappQrCode: string | null;
    var whatsappStatus: 'disconnected' | 'initializing' | 'ready';
    var whatsappPhoneNumber: string | null;
    var whatsappReconnectAttempts: number;
    var whatsappReconnectTimer: NodeJS.Timeout | null;
    var whatsappLastDisconnect: number | null;
    var whatsappHealthCheckTimer: NodeJS.Timeout | null;
    var whatsappRestartHistory: number[];
}

// Initialize globals if they don't exist (for backwards compatibility)
if (typeof global.whatsappStatus === 'undefined') {
    global.whatsappStatus = 'disconnected';
    global.whatsappQrCode = null;
    global.whatsappClient = null;
    global.whatsappPhoneNumber = null;
    global.whatsappReconnectAttempts = 0;
    global.whatsappReconnectTimer = null;
    global.whatsappLastDisconnect = null;
    global.whatsappHealthCheckTimer = null;
    global.whatsappRestartHistory = [];
}

class WhatsAppStateManager {
    private static instance: WhatsAppStateManager;

    private constructor() {
        // Private constructor for singleton pattern
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): WhatsAppStateManager {
        if (!WhatsAppStateManager.instance) {
            WhatsAppStateManager.instance = new WhatsAppStateManager();
        }
        return WhatsAppStateManager.instance;
    }

    // ============================================================================
    // CLIENT - Uses global.whatsappClient directly
    // ============================================================================

    get client(): Client | null {
        return global.whatsappClient;
    }

    set client(value: Client | null) {
        global.whatsappClient = value;
    }

    // ============================================================================
    // STATUS - Uses global.whatsappStatus directly
    // ============================================================================

    get status(): WhatsAppStatus {
        return global.whatsappStatus;
    }

    set status(value: WhatsAppStatus) {
        global.whatsappStatus = value;
    }

    // ============================================================================
    // QR CODE - Uses global.whatsappQrCode directly
    // ============================================================================

    get qrCode(): string | null {
        return global.whatsappQrCode;
    }

    set qrCode(value: string | null) {
        global.whatsappQrCode = value;
    }

    // ============================================================================
    // PHONE NUMBER - Uses global.whatsappPhoneNumber directly
    // ============================================================================

    get phoneNumber(): string | null {
        return global.whatsappPhoneNumber;
    }

    set phoneNumber(value: string | null) {
        global.whatsappPhoneNumber = value;
    }

    // ============================================================================
    // RECONNECTION - Uses globals directly
    // ============================================================================

    get reconnectAttempts(): number {
        return global.whatsappReconnectAttempts;
    }

    set reconnectAttempts(value: number) {
        global.whatsappReconnectAttempts = value;
    }

    get reconnectTimer(): NodeJS.Timeout | null {
        return global.whatsappReconnectTimer;
    }

    set reconnectTimer(value: NodeJS.Timeout | null) {
        global.whatsappReconnectTimer = value;
    }

    get lastDisconnect(): number | null {
        return global.whatsappLastDisconnect;
    }

    set lastDisconnect(value: number | null) {
        global.whatsappLastDisconnect = value;
    }

    // ============================================================================
    // HEALTH CHECK - Uses global.whatsappHealthCheckTimer directly
    // ============================================================================

    get healthCheckTimer(): NodeJS.Timeout | null {
        return global.whatsappHealthCheckTimer;
    }

    set healthCheckTimer(value: NodeJS.Timeout | null) {
        global.whatsappHealthCheckTimer = value;
    }

    // ============================================================================
    // RESTART HISTORY - Uses global.whatsappRestartHistory directly
    // ============================================================================

    get restartHistory(): number[] {
        return global.whatsappRestartHistory;
    }

    set restartHistory(value: number[]) {
        global.whatsappRestartHistory = value;
    }

    addRestartTimestamp(timestamp: number): void {
        global.whatsappRestartHistory.push(timestamp);
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Get status response for API
     */
    getStatusResponse(): WhatsAppStatusResponse {
        return {
            status: global.whatsappStatus,
            qrCode: global.whatsappQrCode,
            phoneNumber: global.whatsappPhoneNumber,
        };
    }

    /**
     * Get full state snapshot (for debugging)
     */
    getSnapshot(): WhatsAppClientState {
        return {
            client: global.whatsappClient,
            status: global.whatsappStatus,
            qrCode: global.whatsappQrCode,
            phoneNumber: global.whatsappPhoneNumber,
            reconnectAttempts: global.whatsappReconnectAttempts,
            reconnectTimer: global.whatsappReconnectTimer,
            lastDisconnect: global.whatsappLastDisconnect,
            healthCheckTimer: global.whatsappHealthCheckTimer,
            restartHistory: [...global.whatsappRestartHistory],
        };
    }

    /**
     * Reset all state to initial values
     */
    reset(): void {
        global.whatsappClient = null;
        global.whatsappStatus = 'disconnected';
        global.whatsappQrCode = null;
        global.whatsappPhoneNumber = null;
        global.whatsappReconnectAttempts = 0;
        if (global.whatsappReconnectTimer) {
            clearTimeout(global.whatsappReconnectTimer);
        }
        global.whatsappReconnectTimer = null;
        global.whatsappLastDisconnect = null;
        if (global.whatsappHealthCheckTimer) {
            clearInterval(global.whatsappHealthCheckTimer);
        }
        global.whatsappHealthCheckTimer = null;
        global.whatsappRestartHistory = [];
    }

    /**
     * Check if client is available and ready
     */
    isClientAvailable(): boolean {
        return global.whatsappClient !== null && global.whatsappStatus === 'ready';
    }
}

// Export singleton instance
export const state = WhatsAppStateManager.getInstance();

// Export class for testing purposes
export { WhatsAppStateManager };
