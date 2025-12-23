"use strict";
/**
 * WhatsApp Health Check Service
 *
 * Manages connection health monitoring and automatic reconnection:
 * - Periodic health checks to verify connection state
 * - Exponential backoff reconnection logic
 * - Restart loop detection and prevention
 *
 * Following:
 * - SRP: Only handles health and reconnection logic
 * - DIP: Depends on state abstraction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckService = void 0;
const logger_1 = require("../../lib/logger");
const db_1 = require("../db");
const messageQueue_1 = require("../messageQueue");
class HealthCheckService {
    constructor(state, config) {
        this.state = state;
        this.config = config;
        this.clientInitializer = null;
    }
    /**
     * Set the client initializer function (called from client manager)
     * This breaks the circular dependency between health and client
     */
    setClientInitializer(initializer) {
        this.clientInitializer = initializer;
    }
    /**
     * Add a system notification to the database
     */
    async addSystemAlert(title, message, type = 'info') {
        try {
            await db_1.pool.query('INSERT INTO system_notifications (title, message, type) VALUES ($1, $2, $3)', [title, message, type]);
        }
        catch (e) {
            logger_1.whatsappLogger.error('Error adding system alert:', e);
        }
    }
    /**
     * Clean up old restart timestamps and check if we can restart
     * Returns true if within limits, false if too many restarts
     */
    canRestart() {
        const now = Date.now();
        const windowStart = now - this.config.RESTART_WINDOW_MS;
        // Filter out old restarts outside the window
        this.state.restartHistory = this.state.restartHistory.filter(ts => ts > windowStart);
        // Check if we're within limits
        if (this.state.restartHistory.length >= this.config.MAX_RESTARTS_PER_WINDOW) {
            logger_1.whatsappLogger.error(`❌ Too many restarts detected! ${this.state.restartHistory.length} restarts in the last ${this.config.RESTART_WINDOW_MS / 60000} minutes.`);
            messageQueue_1.messageQueue.addLog(`❌ Loop de restart detectado! ${this.state.restartHistory.length} restarts recentes. Parando para evitar loop infinito.`, 'error');
            this.addSystemAlert('WhatsApp - Loop de Restart Detectado', `Sistema detectou ${this.state.restartHistory.length} restarts em ${this.config.RESTART_WINDOW_MS / 60000} minutos. Intervenção manual necessária.`, 'error');
            return false;
        }
        // Add current restart to history
        this.state.addRestartTimestamp(now);
        return true;
    }
    /**
     * Check if client is actually connected (query real state)
     */
    async isClientReady() {
        try {
            if (!this.state.client) {
                logger_1.whatsappLogger.debug('⏸️ isClientReady: No client instance');
                return false;
            }
            const clientState = await this.state.client.getState();
            logger_1.whatsappLogger.debug(` isClientReady: Client state = ${clientState}, global status = ${this.state.status}`);
            const isReady = clientState === 'CONNECTED';
            // Sync global status if out of sync
            if (isReady && this.state.status !== 'ready') {
                logger_1.whatsappLogger.debug(' ⚠️ Status dessincronizado! Cliente está CONNECTED mas status não está "ready". Corrigindo...');
                this.state.status = 'ready';
            }
            else if (!isReady && this.state.status === 'ready') {
                logger_1.whatsappLogger.debug(' ⚠️ Status dessincronizado! Status está "ready" mas cliente não está CONNECTED. Corrigindo...');
                this.state.status = 'disconnected';
            }
            return isReady;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            // If getState() fails with Puppeteer errors, but we have a client and status is ready,
            // assume it's a temporary issue and trust the global state
            if (this.state.client && this.state.status === 'ready' &&
                (errorMsg.includes('Evaluation failed') ||
                    errorMsg.includes('Cannot read properties of undefined'))) {
                logger_1.whatsappLogger.warn('⚠️ Client state check failed with Puppeteer error, but trusting global state (ready)');
                return true; // Trust the global state
            }
            logger_1.whatsappLogger.error('❌ Error checking client state:', error);
            return false;
        }
    }
    /**
     * Start periodic health check monitoring
     */
    start() {
        // Clear any existing health check timer
        if (this.state.healthCheckTimer) {
            clearInterval(this.state.healthCheckTimer);
        }
        logger_1.whatsappLogger.debug(` 🏥 Iniciando health check periódico (intervalo: ${this.config.HEALTH_CHECK_INTERVAL_MS / 60000} minutos)`);
        this.state.healthCheckTimer = setInterval(async () => {
            logger_1.whatsappLogger.debug(' 🏥 Executando health check...');
            try {
                const isReady = await this.isClientReady();
                if (!isReady && this.state.status === 'ready') {
                    logger_1.whatsappLogger.warn(' ⚠️ Health check detectou inconsistência: status "ready" mas cliente não está CONNECTED');
                    messageQueue_1.messageQueue.addLog('⚠️ Health check: cliente não está realmente conectado. Tentando reconectar...', 'info');
                    // Trigger reconnection
                    this.state.status = 'disconnected';
                    this.attemptReconnect();
                }
                else if (isReady && this.state.status !== 'ready') {
                    logger_1.whatsappLogger.debug(' ✅ Health check: corrigindo status dessincronizado para "ready"');
                    this.state.status = 'ready';
                }
                else if (isReady) {
                    logger_1.whatsappLogger.debug(' ✅ Health check: OK - Cliente conectado e funcionando');
                }
                else {
                    logger_1.whatsappLogger.debug(' 🟡 Health check: Cliente não conectado (esperado se ainda não autenticou)');
                }
            }
            catch (error) {
                logger_1.whatsappLogger.error(' ❌ Erro durante health check:', error);
            }
        }, this.config.HEALTH_CHECK_INTERVAL_MS);
    }
    /**
     * Stop the health check timer
     */
    stop() {
        if (this.state.healthCheckTimer) {
            clearInterval(this.state.healthCheckTimer);
            this.state.healthCheckTimer = null;
        }
    }
    /**
     * Attempt to reconnect with exponential backoff
     */
    async attemptReconnect() {
        // Clear any existing reconnect timer
        if (this.state.reconnectTimer) {
            clearTimeout(this.state.reconnectTimer);
            this.state.reconnectTimer = null;
        }
        // Check if we've exceeded max attempts
        if (this.state.reconnectAttempts >= this.config.RECONNECT_MAX_ATTEMPTS) {
            logger_1.whatsappLogger.error(' ❌ Máximo de tentativas de reconexão atingido. Intervenção manual necessária.');
            messageQueue_1.messageQueue.addLog(`❌ Falha após ${this.config.RECONNECT_MAX_ATTEMPTS} tentativas. Reconecte manualmente.`, 'error');
            this.addSystemAlert('WhatsApp - Reconexão Falhada', `Falhou após ${this.config.RECONNECT_MAX_ATTEMPTS} tentativas. Por favor, reconecte manualmente.`, 'error');
            // Try to notify admin
            try {
                if (this.state.client) {
                    await this.state.client.sendMessage(this.config.ADMIN_PHONE, `🔴 ALERTA CRÍTICO: WhatsApp falhou após ${this.config.RECONNECT_MAX_ATTEMPTS} tentativas de reconexão. Intervenção manual necessária.`);
                }
            }
            catch (e) {
                logger_1.whatsappLogger.error(' Falha ao notificar admin sobre erro crítico:', e);
            }
            return;
        }
        const attempt = this.state.reconnectAttempts;
        const delay = this.config.RECONNECT_DELAYS_MS[Math.min(attempt, this.config.RECONNECT_DELAYS_MS.length - 1)];
        logger_1.whatsappLogger.debug(` 🔄 Agendando reconexão (tentativa ${attempt + 1}/${this.config.RECONNECT_MAX_ATTEMPTS}) em ${delay / 1000}s...`);
        messageQueue_1.messageQueue.addLog(`🔄 Reconexão automática em ${delay / 1000}s (tentativa ${attempt + 1}/${this.config.RECONNECT_MAX_ATTEMPTS})`, 'info');
        // Notify admin after 3 failed attempts
        if (attempt === 2) {
            logger_1.whatsappLogger.debug(' ⚠️ Notificando admin sobre problemas de conexão...');
            try {
                if (this.state.client) {
                    await this.state.client.sendMessage(this.config.ADMIN_PHONE, `⚠️ AVISO: WhatsApp está tendo problemas de conexão. ${attempt + 1} tentativas de reconexão até agora.`);
                }
            }
            catch (e) {
                logger_1.whatsappLogger.error(' Falha ao notificar admin:', e);
            }
        }
        this.state.reconnectTimer = setTimeout(async () => {
            this.state.reconnectAttempts++;
            logger_1.whatsappLogger.debug(` 🔄 Tentativa de reconexão ${this.state.reconnectAttempts}/${this.config.RECONNECT_MAX_ATTEMPTS}...`);
            messageQueue_1.messageQueue.addLog(`🔄 Tentando reconectar (${this.state.reconnectAttempts}/${this.config.RECONNECT_MAX_ATTEMPTS})...`, 'info');
            try {
                // Destroy old client if exists
                if (this.state.client) {
                    try {
                        await this.state.client.destroy();
                    }
                    catch (e) {
                        logger_1.whatsappLogger.error(' Erro ao destruir cliente antigo:', e);
                    }
                    this.state.client = null;
                }
                // Force status reset
                this.state.status = 'disconnected';
                this.state.qrCode = null;
                // Re-initialize client using the injected initializer
                logger_1.whatsappLogger.debug(' Reinicializando cliente...');
                if (this.clientInitializer) {
                    this.clientInitializer();
                }
                else {
                    logger_1.whatsappLogger.error(' No client initializer set! Cannot reinitialize.');
                }
                // If initialization succeeds, reconnect attempts will be reset in the 'ready' handler
            }
            catch (error) {
                logger_1.whatsappLogger.error(' Erro durante reconexão:', error);
                // Schedule another attempt
                this.attemptReconnect();
            }
        }, delay);
    }
    /**
     * Reset reconnection state (called on successful connection)
     */
    resetReconnectState() {
        if (this.state.reconnectAttempts > 0) {
            logger_1.whatsappLogger.debug(` ✅ Reconexão bem-sucedida após ${this.state.reconnectAttempts} tentativa(s)!`);
            messageQueue_1.messageQueue.addLog(`✅ Reconectado com sucesso após ${this.state.reconnectAttempts} tentativa(s)!`, 'success');
        }
        this.state.reconnectAttempts = 0;
        // Clear any pending reconnect timer
        if (this.state.reconnectTimer) {
            clearTimeout(this.state.reconnectTimer);
            this.state.reconnectTimer = null;
        }
    }
}
exports.HealthCheckService = HealthCheckService;
