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

    // Internal state - matches the old globals
    private _client: Client | null = null;
    private _status: WhatsAppStatus = 'disconnected';
    private _qrCode: string | null = null;
    private _phoneNumber: string | null = null;
    private _reconnectAttempts: number = 0;
    private _reconnectTimer: NodeJS.Timeout | null = null;
    private _lastDisconnect: number | null = null;
    private _healthCheckTimer: NodeJS.Timeout | null = null;
    private _restartHistory: number[] = [];

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
    // CLIENT
    // ============================================================================

    get client(): Client | null {
        return this._client;
    }

    set client(value: Client | null) {
        this._client = value;
    }

    // ============================================================================
    // STATUS
    // ============================================================================

    get status(): WhatsAppStatus {
        return this._status;
    }

    set status(value: WhatsAppStatus) {
        this._status = value;
    }

    // ============================================================================
    // QR CODE
    // ============================================================================

    get qrCode(): string | null {
        return this._qrCode;
    }

    set qrCode(value: string | null) {
        this._qrCode = value;
    }

    // ============================================================================
    // PHONE NUMBER
    // ============================================================================

    get phoneNumber(): string | null {
        return this._phoneNumber;
    }

    set phoneNumber(value: string | null) {
        this._phoneNumber = value;
    }

    // ============================================================================
    // RECONNECTION
    // ============================================================================

    get reconnectAttempts(): number {
        return this._reconnectAttempts;
    }

    set reconnectAttempts(value: number) {
        this._reconnectAttempts = value;
    }

    get reconnectTimer(): NodeJS.Timeout | null {
        return this._reconnectTimer;
    }

    set reconnectTimer(value: NodeJS.Timeout | null) {
        this._reconnectTimer = value;
    }

    get lastDisconnect(): number | null {
        return this._lastDisconnect;
    }

    set lastDisconnect(value: number | null) {
        this._lastDisconnect = value;
    }

    // ============================================================================
    // HEALTH CHECK
    // ============================================================================

    get healthCheckTimer(): NodeJS.Timeout | null {
        return this._healthCheckTimer;
    }

    set healthCheckTimer(value: NodeJS.Timeout | null) {
        this._healthCheckTimer = value;
    }

    // ============================================================================
    // RESTART HISTORY
    // ============================================================================

    get restartHistory(): number[] {
        return this._restartHistory;
    }

    set restartHistory(value: number[]) {
        this._restartHistory = value;
    }

    addRestartTimestamp(timestamp: number): void {
        this._restartHistory.push(timestamp);
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Get status response for API
     */
    getStatusResponse(): WhatsAppStatusResponse {
        return {
            status: this._status,
            qrCode: this._qrCode,
            phoneNumber: this._phoneNumber,
        };
    }

    /**
     * Get full state snapshot (for debugging)
     */
    getSnapshot(): WhatsAppClientState {
        return {
            client: this._client,
            status: this._status,
            qrCode: this._qrCode,
            phoneNumber: this._phoneNumber,
            reconnectAttempts: this._reconnectAttempts,
            reconnectTimer: this._reconnectTimer,
            lastDisconnect: this._lastDisconnect,
            healthCheckTimer: this._healthCheckTimer,
            restartHistory: [...this._restartHistory],
        };
    }

    /**
     * Reset all state to initial values
     */
    reset(): void {
        this._client = null;
        this._status = 'disconnected';
        this._qrCode = null;
        this._phoneNumber = null;
        this._reconnectAttempts = 0;
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
        }
        this._reconnectTimer = null;
        this._lastDisconnect = null;
        if (this._healthCheckTimer) {
            clearInterval(this._healthCheckTimer);
        }
        this._healthCheckTimer = null;
        this._restartHistory = [];
    }

    /**
     * Check if client is available and ready
     */
    isClientAvailable(): boolean {
        return this._client !== null && this._status === 'ready';
    }
}

// Export singleton instance
export const state = WhatsAppStateManager.getInstance();

// Export class for testing purposes
export { WhatsAppStateManager };
