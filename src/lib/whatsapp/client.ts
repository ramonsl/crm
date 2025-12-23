/**
 * WhatsApp Client Manager - Connection Lifecycle
 * 
 * Manages the WhatsApp client lifecycle:
 * - Initialization and configuration
 * - Event registration
 * - Session management (logout, reset)
 * - Status queries
 * 
 * Following:
 * - SRP: Only handles client lifecycle
 * - DIP: Depends on state, health service, and message handler abstractions
 */

import fs from 'fs';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { getErrorMessage } from '@/lib/types';
import { whatsappLogger } from '@/lib/logger';
import type { WhatsAppStateManager } from './state';
import type { HealthCheckService } from './health';
import type { MessageEventHandler } from './events/messageHandler';
import type { WhatsAppStatusResponse } from './types';
import { pool } from '../db';
import { messageQueue } from '../messageQueue';
import { WHATSAPP_CONFIG } from '../constants';

export class WhatsAppClientManager {
    constructor(
        private state: WhatsAppStateManager,
        private healthService: HealthCheckService,
        private messageHandler: MessageEventHandler
    ) {
        // Set up the client initializer for reconnection
        this.healthService.setClientInitializer(() => this.initialize());
    }

    /**
     * Add system notification to database
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
            whatsappLogger.error('Error adding system alert:', e);
        }
    }

    /**
     * Determine session path based on environment
     */
    private getSessionPath(): string {
        if (process.env.WHATSAPP_SESSION_PATH) {
            return process.env.WHATSAPP_SESSION_PATH;
        }
        if (process.env.NODE_ENV === 'production') {
            const prodPath = '/app/data/.wwebjs_auth';
            // Create directory if it doesn't exist
            if (!fs.existsSync(prodPath)) {
                fs.mkdirSync(prodPath, { recursive: true });
            }
            return prodPath;
        }
        return './.wwebjs_auth';
    }

    /**
     * Initialize the WhatsApp client
     */
    initialize(): Client {
        // If client exists but is disconnected, destroy it to force fresh init
        if (this.state.client && this.state.status === 'disconnected') {
            whatsappLogger.debug('Client exists but is disconnected. Destroying for fresh init...');
            try {
                this.state.client.destroy();
            } catch (e) {
                whatsappLogger.error('Error destroying stale client:', e);
            }
            this.state.client = null;
        }

        if (!this.state.client) {
            whatsappLogger.info('Initializing WhatsApp Client...');
            messageQueue.addLog('Inicializando cliente WhatsApp...', 'info');
            this.state.status = 'initializing';

            const sessionPath = this.getSessionPath();
            whatsappLogger.debug(`Using session path: ${sessionPath}`);

            const client = new Client({
                authStrategy: new LocalAuth({ dataPath: sessionPath }),
                puppeteer: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                },
            });

            this.state.client = client;
            this.registerEventHandlers(client);

            client.initialize().catch(err => {
                whatsappLogger.error('Failed to initialize client:', err);
                messageQueue.addLog(`Falha ao inicializar: ${getErrorMessage(err)}`, 'error');
                this.state.status = 'disconnected';
                this.state.client = null;
            });
        }

        return this.state.client!;
    }

    /**
     * Register all event handlers on the client
     */
    private registerEventHandlers(client: Client): void {
        // QR Code received
        client.on('qr', (qr) => {
            this.state.qrCode = qr;
            this.state.status = 'initializing';
            whatsappLogger.info('QR Code received');
            messageQueue.addLog('QR Code recebido! Escaneie agora.', 'info');
        });

        // Client ready
        client.on('ready', async () => {
            this.state.status = 'ready';
            this.state.qrCode = null;

            // Capture connected phone number
            try {
                const info = client.info;
                if (info && info.wid) {
                    this.state.phoneNumber = info.wid.user;
                    whatsappLogger.info(`Connected phone number: ${this.state.phoneNumber}`);
                }
            } catch (e) {
                whatsappLogger.error('Error getting connected phone:', e);
            }

            whatsappLogger.info('🟢 CLIENT IS READY! WHATSAPP CONNECTED!');
            messageQueue.addLog('WhatsApp Conectado e Pronto!', 'success');
            this.addSystemAlert('WhatsApp Conectado', 'A conexão com o WhatsApp foi estabelecida com sucesso.', 'success');

            // Reset reconnection state
            this.healthService.resetReconnectState();

            // Start health check monitoring
            this.healthService.start();

            // Send notification to admin
            try {
                const adminPhone = '555181636027@c.us';
                await client.sendMessage(adminPhone, '🤖 Sistema CRM: Conexão com WhatsApp estabelecida com sucesso!');
                whatsappLogger.debug(`Connection notification sent to ${adminPhone}`);
            } catch (e) {
                whatsappLogger.error('Failed to send connection notification:', e);
            }
        });

        // Authenticated
        client.on('authenticated', () => {
            this.state.status = 'ready';
            this.state.qrCode = null;
            whatsappLogger.info('Authenticated successfully');
            messageQueue.addLog('Autenticado com sucesso!', 'success');
        });

        // Auth failure
        client.on('auth_failure', () => {
            this.state.status = 'disconnected';
            this.state.qrCode = null;
            whatsappLogger.error('Authentication failure');
            messageQueue.addLog('Falha na autenticação.', 'error');
            this.addSystemAlert('Falha na Autenticação', 'O WhatsApp falhou ao autenticar. Por favor, reconecte.', 'error');
            this.state.client = null;
            this.state.lastDisconnect = Date.now();

            whatsappLogger.warn('Auth failure detected. Attempting reconnect...');
            this.healthService.attemptReconnect();
        });

        // Disconnected
        client.on('disconnected', (reason) => {
            this.state.status = 'disconnected';
            this.state.qrCode = null;
            const reasonStr = reason || 'unknown';
            whatsappLogger.warn(`Client disconnected. Reason: ${reasonStr}`);
            messageQueue.addLog(`Cliente desconectado. Motivo: ${reasonStr}`, 'error');
            this.addSystemAlert('WhatsApp Desconectado', `O cliente WhatsApp foi desconectado. Motivo: ${reasonStr}`, 'error');
            this.state.client = null;
            this.state.lastDisconnect = Date.now();

            // Stop health check while disconnected
            this.healthService.stop();

            whatsappLogger.info('Starting automatic reconnection...');
            this.healthService.attemptReconnect();
        });

        // Error
        client.on('error', (error) => {
            whatsappLogger.error('❌ Client error:', error);
            messageQueue.addLog(`❌ Erro no cliente: ${error.message || error}`, 'error');

            const errorStr = String(error);
            if (errorStr.includes('Protocol error') ||
                errorStr.includes('Session closed') ||
                errorStr.includes('Target closed')) {
                whatsappLogger.error('Critical error detected. Attempting reconnect...');
                this.healthService.attemptReconnect();
            }
        });

        // Remote session saved
        client.on('remote_session_saved', () => {
            whatsappLogger.info('✅ Remote session saved successfully');
            messageQueue.addLog('✅ Sessão salva', 'success');
        });

        // Loading screen
        client.on('loading_screen', (percent, message) => {
            whatsappLogger.debug(`📱 Loading... ${percent}% - ${message}`);
        });

        // State change
        client.on('change_state', (state) => {
            whatsappLogger.debug(`🔄 State changed to: ${state}`);
        });

        // Message create - the main event handler
        whatsappLogger.debug('🎯 Registering message_create event listener...');
        client.on('message_create', (msg) => this.messageHandler.handle(msg as any));

        // Message acknowledgment
        client.on('message_ack', async (msg, ack) => {
            whatsappLogger.debug(`ACK received for message ${msg.id.id}: ${ack}`);

            let status = 'sent';
            if (ack === 1) status = 'sent';
            else if (ack === 2) status = 'delivered';
            else if (ack >= 3) status = 'read';
            else if (ack === -1) status = 'failed';

            try {
                const result = await pool.query('UPDATE messages SET type = $1 WHERE id = $2', [status, msg.id.id]);

                if (result.rowCount && result.rowCount > 0) {
                    whatsappLogger.debug(`Message ${msg.id.id} updated to status: ${status}`);
                } else {
                    whatsappLogger.debug(`Message ${msg.id.id} not found in DB to update status.`);
                }
            } catch (error) {
                whatsappLogger.error('Error updating message status:', error);
            }
        });
    }

    /**
     * Get current status
     */
    getStatus(): WhatsAppStatusResponse {
        // Try to capture phone number if client is ready but phoneNumber is not set
        if (this.state.status === 'ready' && !this.state.phoneNumber && this.state.client) {
            try {
                const info = this.state.client.info;
                if (info && info.wid) {
                    this.state.phoneNumber = info.wid.user;
                    whatsappLogger.debug(`Captured phone number from existing session: ${this.state.phoneNumber}`);
                }
            } catch (e) {
                whatsappLogger.error('Error getting phone from existing session:', e);
            }
        }

        return this.state.getStatusResponse();
    }

    /**
     * Restart the client
     */
    async restart(): Promise<void> {
        whatsappLogger.info('Restarting client...');
        messageQueue.addLog('Reiniciando cliente WhatsApp...', 'info');

        if (this.state.client) {
            try {
                await this.state.client.destroy();
            } catch (e) {
                whatsappLogger.error('Error destroying client:', e);
            }
            this.state.client = null;
            this.state.status = 'disconnected';
        }

        this.initialize();
    }

    /**
     * Logout from WhatsApp
     */
    async logout(): Promise<void> {
        whatsappLogger.info('Logging out...');
        messageQueue.addLog('Desconectando WhatsApp...', 'info');

        if (this.state.client) {
            try {
                await this.state.client.logout();
                messageQueue.addLog('Logout executado com sucesso.', 'success');
            } catch (e) {
                whatsappLogger.error('Error logging out:', e);
                messageQueue.addLog('Erro ao executar logout.', 'error');
            }

            // Check again if client still exists before destroying
            if (this.state.client) {
                try {
                    await this.state.client.destroy();
                    messageQueue.addLog('Cliente destruído com sucesso.', 'success');
                } catch (e) {
                    whatsappLogger.error('Error destroying client:', e);
                    messageQueue.addLog('Erro ao destruir cliente.', 'error');
                }
            }

            this.state.client = null;
            this.state.status = 'disconnected';
            this.state.qrCode = null;
            messageQueue.addLog('WhatsApp desconectado.', 'success');
        }
    }

    /**
     * Reset session (delete auth folder)
     */
    async resetSession(autoReconnect: boolean = false): Promise<void> {
        whatsappLogger.info('Resetting session...');
        messageQueue.addLog('Resetando sessão e apagando dados de autenticação...', 'info');

        // Force destroy first
        if (this.state.client) {
            try {
                await this.state.client.destroy();
            } catch (e) {
                whatsappLogger.error('Error destroying client:', e);
            }
            this.state.client = null;
            this.state.status = 'disconnected';
            this.state.qrCode = null;
        }

        // Wait a bit to ensure file locks are released
        await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONFIG.RETRY_DELAY_MS));

        // Delete auth folder
        const fsPromises = await import('fs/promises');
        const path = await import('path');
        const authPath = path.resolve('./.wwebjs_auth');

        try {
            await fsPromises.rm(authPath, { recursive: true, force: true });
            whatsappLogger.info('Auth folder deleted');
            messageQueue.addLog('Dados de autenticação apagados.', 'success');
        } catch (e) {
            whatsappLogger.error('Error deleting auth folder:', e);
            messageQueue.addLog('Erro ao apagar dados de autenticação (pode estar em uso).', 'error');
        }

        // Re-initialize automatically only if requested
        if (autoReconnect) {
            whatsappLogger.info('Session reset complete. Re-initializing...');
            messageQueue.addLog('Sessão resetada. Reiniciando cliente...', 'info');
            this.initialize();
        } else {
            whatsappLogger.info('Session reset complete.');
            messageQueue.addLog('Sessão resetada com sucesso.', 'success');
        }
    }

    /**
     * Check if client is ready (delegates to health service)
     */
    async isReady(): Promise<boolean> {
        return this.healthService.isClientReady();
    }
}
