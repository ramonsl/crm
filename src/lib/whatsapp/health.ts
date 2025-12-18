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

import type { WhatsAppStateManager } from './state';
import { pool } from '../db';
import { messageQueue } from '../messageQueue';
import { WHATSAPP_CONFIG } from '../constants';

// Forward declare to avoid circular dependency
// The actual client manager will be injected at runtime
type ClientInitializer = () => void;

export class HealthCheckService {
    private clientInitializer: ClientInitializer | null = null;

    constructor(
        private state: WhatsAppStateManager,
        private config: typeof WHATSAPP_CONFIG
    ) { }

    /**
     * Set the client initializer function (called from client manager)
     * This breaks the circular dependency between health and client
     */
    setClientInitializer(initializer: ClientInitializer): void {
        this.clientInitializer = initializer;
    }

    /**
     * Add a system notification to the database
     */
    private async addSystemAlert(
        title: string,
        message: string,
        type: 'info' | 'warning' | 'error' | 'success' = 'info'
    ): Promise<void> {
        try {
            await pool.query(
                'INSERT INTO system_notifications (title, message, type) VALUES ($1, $2, $3)',
                [title, message, type]
            );
        } catch (e) {
            console.error('Error adding system alert:', e);
        }
    }

    /**
     * Clean up old restart timestamps and check if we can restart
     * Returns true if within limits, false if too many restarts
     */
    canRestart(): boolean {
        const now = Date.now();
        const windowStart = now - this.config.RESTART_WINDOW_MS;

        // Filter out old restarts outside the window
        this.state.restartHistory = this.state.restartHistory.filter(ts => ts > windowStart);

        // Check if we're within limits
        if (this.state.restartHistory.length >= this.config.MAX_RESTARTS_PER_WINDOW) {
            console.error(
                `[WhatsApp] ❌ Muitos restarts detectados! ${this.state.restartHistory.length} restarts nos últimos ${this.config.RESTART_WINDOW_MS / 60000} minutos.`
            );
            messageQueue.addLog(
                `❌ Loop de restart detectado! ${this.state.restartHistory.length} restarts recentes. Parando para evitar loop infinito.`,
                'error'
            );
            this.addSystemAlert(
                'WhatsApp - Loop de Restart Detectado',
                `Sistema detectou ${this.state.restartHistory.length} restarts em ${this.config.RESTART_WINDOW_MS / 60000} minutos. Intervenção manual necessária.`,
                'error'
            );
            return false;
        }

        // Add current restart to history
        this.state.addRestartTimestamp(now);
        return true;
    }

    /**
     * Check if client is actually connected (query real state)
     */
    async isClientReady(): Promise<boolean> {
        try {
            if (!this.state.client) {
                console.log('[WhatsApp] isClientReady: No client instance');
                return false;
            }

            const clientState = await this.state.client.getState();
            console.log(`[WhatsApp] isClientReady: Client state = ${clientState}, global status = ${this.state.status}`);

            const isReady = clientState === 'CONNECTED';

            // Sync global status if out of sync
            if (isReady && this.state.status !== 'ready') {
                console.log('[WhatsApp] ⚠️ Status dessincronizado! Cliente está CONNECTED mas status não está "ready". Corrigindo...');
                this.state.status = 'ready';
            } else if (!isReady && this.state.status === 'ready') {
                console.log('[WhatsApp] ⚠️ Status dessincronizado! Status está "ready" mas cliente não está CONNECTED. Corrigindo...');
                this.state.status = 'disconnected';
            }

            return isReady;
        } catch (error) {
            console.error('[WhatsApp] Error checking client state:', error);
            return false;
        }
    }

    /**
     * Start periodic health check monitoring
     */
    start(): void {
        // Clear any existing health check timer
        if (this.state.healthCheckTimer) {
            clearInterval(this.state.healthCheckTimer);
        }

        console.log(`[WhatsApp] 🏥 Iniciando health check periódico (intervalo: ${this.config.HEALTH_CHECK_INTERVAL_MS / 60000} minutos)`);

        this.state.healthCheckTimer = setInterval(async () => {
            console.log('[WhatsApp] 🏥 Executando health check...');

            try {
                const isReady = await this.isClientReady();

                if (!isReady && this.state.status === 'ready') {
                    console.warn('[WhatsApp] ⚠️ Health check detectou inconsistência: status "ready" mas cliente não está CONNECTED');
                    messageQueue.addLog('⚠️ Health check: cliente não está realmente conectado. Tentando reconectar...', 'info');

                    // Trigger reconnection
                    this.state.status = 'disconnected';
                    this.attemptReconnect();
                } else if (isReady && this.state.status !== 'ready') {
                    console.log('[WhatsApp] ✅ Health check: corrigindo status dessincronizado para "ready"');
                    this.state.status = 'ready';
                } else if (isReady) {
                    console.log('[WhatsApp] ✅ Health check: OK - Cliente conectado e funcionando');
                } else {
                    console.log('[WhatsApp] 🟡 Health check: Cliente não conectado (esperado se ainda não autenticou)');
                }
            } catch (error) {
                console.error('[WhatsApp] ❌ Erro durante health check:', error);
            }
        }, this.config.HEALTH_CHECK_INTERVAL_MS);
    }

    /**
     * Stop the health check timer
     */
    stop(): void {
        if (this.state.healthCheckTimer) {
            clearInterval(this.state.healthCheckTimer);
            this.state.healthCheckTimer = null;
        }
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    async attemptReconnect(): Promise<void> {
        // Clear any existing reconnect timer
        if (this.state.reconnectTimer) {
            clearTimeout(this.state.reconnectTimer);
            this.state.reconnectTimer = null;
        }

        // Check if we've exceeded max attempts
        if (this.state.reconnectAttempts >= this.config.RECONNECT_MAX_ATTEMPTS) {
            console.error('[WhatsApp] ❌ Máximo de tentativas de reconexão atingido. Intervenção manual necessária.');
            messageQueue.addLog(`❌ Falha após ${this.config.RECONNECT_MAX_ATTEMPTS} tentativas. Reconecte manualmente.`, 'error');
            this.addSystemAlert(
                'WhatsApp - Reconexão Falhada',
                `Falhou após ${this.config.RECONNECT_MAX_ATTEMPTS} tentativas. Por favor, reconecte manualmente.`,
                'error'
            );

            // Try to notify admin
            try {
                if (this.state.client) {
                    await this.state.client.sendMessage(
                        this.config.ADMIN_PHONE,
                        `🔴 ALERTA CRÍTICO: WhatsApp falhou após ${this.config.RECONNECT_MAX_ATTEMPTS} tentativas de reconexão. Intervenção manual necessária.`
                    );
                }
            } catch (e) {
                console.error('[WhatsApp] Falha ao notificar admin sobre erro crítico:', e);
            }

            return;
        }

        const attempt = this.state.reconnectAttempts;
        const delay = this.config.RECONNECT_DELAYS_MS[Math.min(attempt, this.config.RECONNECT_DELAYS_MS.length - 1)];

        console.log(`[WhatsApp] 🔄 Agendando reconexão (tentativa ${attempt + 1}/${this.config.RECONNECT_MAX_ATTEMPTS}) em ${delay / 1000}s...`);
        messageQueue.addLog(`🔄 Reconexão automática em ${delay / 1000}s (tentativa ${attempt + 1}/${this.config.RECONNECT_MAX_ATTEMPTS})`, 'info');

        // Notify admin after 3 failed attempts
        if (attempt === 2) {
            console.log('[WhatsApp] ⚠️ Notificando admin sobre problemas de conexão...');
            try {
                if (this.state.client) {
                    await this.state.client.sendMessage(
                        this.config.ADMIN_PHONE,
                        `⚠️ AVISO: WhatsApp está tendo problemas de conexão. ${attempt + 1} tentativas de reconexão até agora.`
                    );
                }
            } catch (e) {
                console.error('[WhatsApp] Falha ao notificar admin:', e);
            }
        }

        this.state.reconnectTimer = setTimeout(async () => {
            this.state.reconnectAttempts++;
            console.log(`[WhatsApp] 🔄 Tentativa de reconexão ${this.state.reconnectAttempts}/${this.config.RECONNECT_MAX_ATTEMPTS}...`);
            messageQueue.addLog(`🔄 Tentando reconectar (${this.state.reconnectAttempts}/${this.config.RECONNECT_MAX_ATTEMPTS})...`, 'info');

            try {
                // Destroy old client if exists
                if (this.state.client) {
                    try {
                        await this.state.client.destroy();
                    } catch (e) {
                        console.error('[WhatsApp] Erro ao destruir cliente antigo:', e);
                    }
                    this.state.client = null;
                }

                // Force status reset
                this.state.status = 'disconnected';
                this.state.qrCode = null;

                // Re-initialize client using the injected initializer
                console.log('[WhatsApp] Reinicializando cliente...');
                if (this.clientInitializer) {
                    this.clientInitializer();
                } else {
                    console.error('[WhatsApp] No client initializer set! Cannot reinitialize.');
                }

                // If initialization succeeds, reconnect attempts will be reset in the 'ready' handler
            } catch (error) {
                console.error('[WhatsApp] Erro durante reconexão:', error);
                // Schedule another attempt
                this.attemptReconnect();
            }
        }, delay);
    }

    /**
     * Reset reconnection state (called on successful connection)
     */
    resetReconnectState(): void {
        if (this.state.reconnectAttempts > 0) {
            console.log(`[WhatsApp] ✅ Reconexão bem-sucedida após ${this.state.reconnectAttempts} tentativa(s)!`);
            messageQueue.addLog(`✅ Reconectado com sucesso após ${this.state.reconnectAttempts} tentativa(s)!`, 'success');
        }
        this.state.reconnectAttempts = 0;

        // Clear any pending reconnect timer
        if (this.state.reconnectTimer) {
            clearTimeout(this.state.reconnectTimer);
            this.state.reconnectTimer = null;
        }
    }
}
