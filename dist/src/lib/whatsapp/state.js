"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppStateManager = exports.state = void 0;
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
    constructor() {
        // Private constructor for singleton pattern
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!WhatsAppStateManager.instance) {
            WhatsAppStateManager.instance = new WhatsAppStateManager();
        }
        return WhatsAppStateManager.instance;
    }
    // ============================================================================
    // CLIENT - Uses global.whatsappClient directly
    // ============================================================================
    get client() {
        return global.whatsappClient;
    }
    set client(value) {
        global.whatsappClient = value;
    }
    // ============================================================================
    // STATUS - Uses global.whatsappStatus directly
    // ============================================================================
    get status() {
        return global.whatsappStatus;
    }
    set status(value) {
        global.whatsappStatus = value;
    }
    // ============================================================================
    // QR CODE - Uses global.whatsappQrCode directly
    // ============================================================================
    get qrCode() {
        return global.whatsappQrCode;
    }
    set qrCode(value) {
        global.whatsappQrCode = value;
    }
    // ============================================================================
    // PHONE NUMBER - Uses global.whatsappPhoneNumber directly
    // ============================================================================
    get phoneNumber() {
        return global.whatsappPhoneNumber;
    }
    set phoneNumber(value) {
        global.whatsappPhoneNumber = value;
    }
    // ============================================================================
    // RECONNECTION - Uses globals directly
    // ============================================================================
    get reconnectAttempts() {
        return global.whatsappReconnectAttempts;
    }
    set reconnectAttempts(value) {
        global.whatsappReconnectAttempts = value;
    }
    get reconnectTimer() {
        return global.whatsappReconnectTimer;
    }
    set reconnectTimer(value) {
        global.whatsappReconnectTimer = value;
    }
    get lastDisconnect() {
        return global.whatsappLastDisconnect;
    }
    set lastDisconnect(value) {
        global.whatsappLastDisconnect = value;
    }
    // ============================================================================
    // HEALTH CHECK - Uses global.whatsappHealthCheckTimer directly
    // ============================================================================
    get healthCheckTimer() {
        return global.whatsappHealthCheckTimer;
    }
    set healthCheckTimer(value) {
        global.whatsappHealthCheckTimer = value;
    }
    // ============================================================================
    // RESTART HISTORY - Uses global.whatsappRestartHistory directly
    // ============================================================================
    get restartHistory() {
        return global.whatsappRestartHistory;
    }
    set restartHistory(value) {
        global.whatsappRestartHistory = value;
    }
    addRestartTimestamp(timestamp) {
        global.whatsappRestartHistory.push(timestamp);
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    /**
     * Get status response for API
     */
    getStatusResponse() {
        return {
            status: global.whatsappStatus,
            qrCode: global.whatsappQrCode,
            phoneNumber: global.whatsappPhoneNumber,
        };
    }
    /**
     * Get full state snapshot (for debugging)
     */
    getSnapshot() {
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
    reset() {
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
    isClientAvailable() {
        return global.whatsappClient !== null && global.whatsappStatus === 'ready';
    }
}
exports.WhatsAppStateManager = WhatsAppStateManager;
// Export singleton instance
exports.state = WhatsAppStateManager.getInstance();
