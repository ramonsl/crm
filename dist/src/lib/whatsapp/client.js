"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppClientManager = void 0;
const fs_1 = __importDefault(require("fs"));
const whatsapp_web_js_1 = require("whatsapp-web.js");
const types_1 = require("../../lib/types");
const logger_1 = require("../../lib/logger");
const db_1 = require("../db");
const messageQueue_1 = require("../messageQueue");
const constants_1 = require("../constants");
class WhatsAppClientManager {
    constructor(state, healthService, messageHandler) {
        this.state = state;
        this.healthService = healthService;
        this.messageHandler = messageHandler;
        // Set up the client initializer for reconnection
        this.healthService.setClientInitializer(() => this.initialize());
    }
    /**
     * Add system notification to database
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
     * Determine session path based on environment
     */
    getSessionPath() {
        if (process.env.WHATSAPP_SESSION_PATH) {
            return process.env.WHATSAPP_SESSION_PATH;
        }
        if (process.env.NODE_ENV === 'production') {
            const prodPath = '/app/data/.wwebjs_auth';
            // Create directory if it doesn't exist
            if (!fs_1.default.existsSync(prodPath)) {
                fs_1.default.mkdirSync(prodPath, { recursive: true });
            }
            return prodPath;
        }
        return './.wwebjs_auth';
    }
    /**
     * Initialize the WhatsApp client
     */
    initialize() {
        // If client exists but is disconnected, destroy it to force fresh init
        if (this.state.client && this.state.status === 'disconnected') {
            logger_1.whatsappLogger.debug('Client exists but is disconnected. Destroying for fresh init...');
            try {
                this.state.client.destroy();
            }
            catch (e) {
                logger_1.whatsappLogger.error('Error destroying stale client:', e);
            }
            this.state.client = null;
        }
        if (!this.state.client) {
            logger_1.whatsappLogger.info('Initializing WhatsApp Client...');
            messageQueue_1.messageQueue.addLog('Inicializando cliente WhatsApp...', 'info');
            this.state.status = 'initializing';
            const sessionPath = this.getSessionPath();
            logger_1.whatsappLogger.debug(`Using session path: ${sessionPath}`);
            const client = new whatsapp_web_js_1.Client({
                authStrategy: new whatsapp_web_js_1.LocalAuth({ dataPath: sessionPath }),
                puppeteer: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                },
            });
            this.state.client = client;
            this.registerEventHandlers(client);
            client.initialize().catch(err => {
                logger_1.whatsappLogger.error('Failed to initialize client:', err);
                messageQueue_1.messageQueue.addLog(`Falha ao inicializar: ${(0, types_1.getErrorMessage)(err)}`, 'error');
                this.state.status = 'disconnected';
                this.state.client = null;
            });
        }
        return this.state.client;
    }
    /**
     * Register all event handlers on the client
     */
    registerEventHandlers(client) {
        // QR Code received
        client.on('qr', (qr) => {
            this.state.qrCode = qr;
            this.state.status = 'initializing';
            logger_1.whatsappLogger.info('QR Code received');
            messageQueue_1.messageQueue.addLog('QR Code recebido! Escaneie agora.', 'info');
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
                    logger_1.whatsappLogger.info(`Connected phone number: ${this.state.phoneNumber}`);
                }
            }
            catch (e) {
                logger_1.whatsappLogger.error('Error getting connected phone:', e);
            }
            logger_1.whatsappLogger.info('🟢 CLIENT IS READY! WHATSAPP CONNECTED!');
            messageQueue_1.messageQueue.addLog('WhatsApp Conectado e Pronto!', 'success');
            this.addSystemAlert('WhatsApp Conectado', 'A conexão com o WhatsApp foi estabelecida com sucesso.', 'success');
            // Reset reconnection state
            this.healthService.resetReconnectState();
            // Start health check monitoring
            this.healthService.start();
            // Send notification to admin
            try {
                const adminPhone = '555181636027@c.us';
                await client.sendMessage(adminPhone, '🤖 Sistema CRM: Conexão com WhatsApp estabelecida com sucesso!');
                logger_1.whatsappLogger.debug(`Connection notification sent to ${adminPhone}`);
            }
            catch (e) {
                logger_1.whatsappLogger.error('Failed to send connection notification:', e);
            }
        });
        // Authenticated
        client.on('authenticated', () => {
            this.state.status = 'ready';
            this.state.qrCode = null;
            logger_1.whatsappLogger.info('Authenticated successfully');
            messageQueue_1.messageQueue.addLog('Autenticado com sucesso!', 'success');
        });
        // Auth failure
        client.on('auth_failure', () => {
            this.state.status = 'disconnected';
            this.state.qrCode = null;
            logger_1.whatsappLogger.error('Authentication failure');
            messageQueue_1.messageQueue.addLog('Falha na autenticação.', 'error');
            this.addSystemAlert('Falha na Autenticação', 'O WhatsApp falhou ao autenticar. Por favor, reconecte.', 'error');
            this.state.client = null;
            this.state.lastDisconnect = Date.now();
            logger_1.whatsappLogger.warn('Auth failure detected. Attempting reconnect...');
            this.healthService.attemptReconnect();
        });
        // Disconnected
        client.on('disconnected', (reason) => {
            this.state.status = 'disconnected';
            this.state.qrCode = null;
            const reasonStr = reason || 'unknown';
            logger_1.whatsappLogger.warn(`Client disconnected. Reason: ${reasonStr}`);
            messageQueue_1.messageQueue.addLog(`Cliente desconectado. Motivo: ${reasonStr}`, 'error');
            this.addSystemAlert('WhatsApp Desconectado', `O cliente WhatsApp foi desconectado. Motivo: ${reasonStr}`, 'error');
            this.state.client = null;
            this.state.lastDisconnect = Date.now();
            // Stop health check while disconnected
            this.healthService.stop();
            logger_1.whatsappLogger.info('Starting automatic reconnection...');
            this.healthService.attemptReconnect();
        });
        // Error
        client.on('error', (error) => {
            logger_1.whatsappLogger.error('❌ Client error:', error);
            messageQueue_1.messageQueue.addLog(`❌ Erro no cliente: ${error.message || error}`, 'error');
            const errorStr = String(error);
            if (errorStr.includes('Protocol error') ||
                errorStr.includes('Session closed') ||
                errorStr.includes('Target closed')) {
                logger_1.whatsappLogger.error('Critical error detected. Attempting reconnect...');
                this.healthService.attemptReconnect();
            }
        });
        // Remote session saved
        client.on('remote_session_saved', () => {
            logger_1.whatsappLogger.info('✅ Remote session saved successfully');
            messageQueue_1.messageQueue.addLog('✅ Sessão salva', 'success');
        });
        // Loading screen
        client.on('loading_screen', (percent, message) => {
            logger_1.whatsappLogger.debug(`📱 Loading... ${percent}% - ${message}`);
        });
        // State change
        client.on('change_state', (state) => {
            logger_1.whatsappLogger.debug(`🔄 State changed to: ${state}`);
        });
        // Message create - the main event handler
        logger_1.whatsappLogger.debug('🎯 Registering message_create event listener...');
        client.on('message_create', (msg) => this.messageHandler.handle(msg));
        // Message acknowledgment
        client.on('message_ack', async (msg, ack) => {
            logger_1.whatsappLogger.debug(`ACK received for message ${msg.id.id}: ${ack}`);
            let status = 'sent';
            if (ack === 1)
                status = 'sent';
            else if (ack === 2)
                status = 'delivered';
            else if (ack >= 3)
                status = 'read';
            else if (ack === -1)
                status = 'failed';
            try {
                const result = await db_1.pool.query('UPDATE messages SET type = $1 WHERE id = $2', [status, msg.id.id]);
                if (result.rowCount && result.rowCount > 0) {
                    logger_1.whatsappLogger.debug(`Message ${msg.id.id} updated to status: ${status}`);
                }
                else {
                    logger_1.whatsappLogger.debug(`Message ${msg.id.id} not found in DB to update status.`);
                }
            }
            catch (error) {
                logger_1.whatsappLogger.error('Error updating message status:', error);
            }
        });
    }
    /**
     * Get current status
     */
    getStatus() {
        // Try to capture phone number if client is ready but phoneNumber is not set
        if (this.state.status === 'ready' && !this.state.phoneNumber && this.state.client) {
            try {
                const info = this.state.client.info;
                if (info && info.wid) {
                    this.state.phoneNumber = info.wid.user;
                    logger_1.whatsappLogger.debug(`Captured phone number from existing session: ${this.state.phoneNumber}`);
                }
            }
            catch (e) {
                logger_1.whatsappLogger.error('Error getting phone from existing session:', e);
            }
        }
        return this.state.getStatusResponse();
    }
    /**
     * Restart the client
     */
    async restart() {
        logger_1.whatsappLogger.info('Restarting client...');
        messageQueue_1.messageQueue.addLog('Reiniciando cliente WhatsApp...', 'info');
        if (this.state.client) {
            try {
                await this.state.client.destroy();
            }
            catch (e) {
                logger_1.whatsappLogger.error('Error destroying client:', e);
            }
            this.state.client = null;
            this.state.status = 'disconnected';
        }
        this.initialize();
    }
    /**
     * Logout from WhatsApp
     */
    async logout() {
        logger_1.whatsappLogger.info('Logging out...');
        messageQueue_1.messageQueue.addLog('Desconectando WhatsApp...', 'info');
        if (this.state.client) {
            try {
                await this.state.client.logout();
                messageQueue_1.messageQueue.addLog('Logout executado com sucesso.', 'success');
            }
            catch (e) {
                logger_1.whatsappLogger.error('Error logging out:', e);
                messageQueue_1.messageQueue.addLog('Erro ao executar logout.', 'error');
            }
            // Check again if client still exists before destroying
            if (this.state.client) {
                try {
                    await this.state.client.destroy();
                    messageQueue_1.messageQueue.addLog('Cliente destruído com sucesso.', 'success');
                }
                catch (e) {
                    logger_1.whatsappLogger.error('Error destroying client:', e);
                    messageQueue_1.messageQueue.addLog('Erro ao destruir cliente.', 'error');
                }
            }
            this.state.client = null;
            this.state.status = 'disconnected';
            this.state.qrCode = null;
            messageQueue_1.messageQueue.addLog('WhatsApp desconectado.', 'success');
        }
    }
    /**
     * Reset session (delete auth folder)
     */
    async resetSession(autoReconnect = false) {
        logger_1.whatsappLogger.info('Resetting session...');
        messageQueue_1.messageQueue.addLog('Resetando sessão e apagando dados de autenticação...', 'info');
        // Force destroy first
        if (this.state.client) {
            try {
                await this.state.client.destroy();
            }
            catch (e) {
                logger_1.whatsappLogger.error('Error destroying client:', e);
            }
            this.state.client = null;
            this.state.status = 'disconnected';
            this.state.qrCode = null;
        }
        // Wait a bit to ensure file locks are released
        await new Promise(resolve => setTimeout(resolve, constants_1.WHATSAPP_CONFIG.RETRY_DELAY_MS));
        // Delete auth folder
        const fsPromises = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const authPath = path.resolve('./.wwebjs_auth');
        try {
            await fsPromises.rm(authPath, { recursive: true, force: true });
            logger_1.whatsappLogger.info('Auth folder deleted');
            messageQueue_1.messageQueue.addLog('Dados de autenticação apagados.', 'success');
        }
        catch (e) {
            logger_1.whatsappLogger.error('Error deleting auth folder:', e);
            messageQueue_1.messageQueue.addLog('Erro ao apagar dados de autenticação (pode estar em uso).', 'error');
        }
        // Re-initialize automatically only if requested
        if (autoReconnect) {
            logger_1.whatsappLogger.info('Session reset complete. Re-initializing...');
            messageQueue_1.messageQueue.addLog('Sessão resetada. Reiniciando cliente...', 'info');
            this.initialize();
        }
        else {
            logger_1.whatsappLogger.info('Session reset complete.');
            messageQueue_1.messageQueue.addLog('Sessão resetada com sucesso.', 'success');
        }
    }
    /**
     * Check if client is ready (delegates to health service)
     */
    async isReady() {
        return this.healthService.isClientReady();
    }
}
exports.WhatsAppClientManager = WhatsAppClientManager;
