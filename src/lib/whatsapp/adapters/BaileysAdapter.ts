/**
 * Baileys WhatsApp Provider Adapter
 * 
 * Implementa IWhatsAppProvider usando @whiskeysockets/baileys
 * Migrado de baileys.ts para seguir padrão de abstração
 */

import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import pino from 'pino';
import { whatsappLogger } from '@/lib/logger';
import { messageQueue } from '@/lib/messageQueue';
import { emitWhatsAppStatus } from '@/lib/socket/emitter';
import * as QRCode from 'qrcode';
import type {
    IWhatsAppProvider,
    WhatsAppMessage,
    WhatsAppStatusResponse,
    SendMessageResult,
    ContactInfo,
    MessageCallback,
    StatusCallback,
    WhatsAppStatus,
    MediaType
} from '../IWhatsAppProvider';
import { BaseWhatsAppAdapter } from './BaseWhatsAppAdapter';

// Session path configuration
const SESSION_PATH = process.env.NODE_ENV === 'production'
    ? '/tmp/baileys-session'
    : './.baileys_auth';

// Pino logger for Baileys (silent most logs)
const baileysLogger = pino({ level: 'silent' }) as any;

// Reconnection control
const RECONNECT_CONFIG = {
    maxAttempts: 5,
    baseDelayMs: 5000,
    maxDelayMs: 60000,
};

interface BaileysState {
    socket: WASocket | null;
    status: WhatsAppStatus;
    qrCode: string | null;
    phoneNumber: string | null;
    isReconnecting: boolean;
    isInitializing: boolean;
}

export class BaileysAdapter extends BaseWhatsAppAdapter implements IWhatsAppProvider {
    private state: BaileysState = {
        socket: null,
        status: 'disconnected',
        qrCode: null,
        phoneNumber: null,
        isReconnecting: false,
        isInitializing: false,
    };

    private reconnectAttempts = 0;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private messageCallback: MessageCallback | null = null;
    private statusCallback: StatusCallback | null = null;

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    async initialize(): Promise<void> {
        if (this.state.isInitializing) {
            whatsappLogger.warn('Baileys already initializing...');
            return;
        }

        if (this.state.status === 'ready') {
            whatsappLogger.info('Baileys already initialized and ready');
            return;
        }

        this.state.isInitializing = true;
        this.state.status = 'connecting';

        try {
            whatsappLogger.info('Initializing Baileys WhatsApp Client...');

            // Ensure session directory exists
            if (!fs.existsSync(SESSION_PATH)) {
                fs.mkdirSync(SESSION_PATH, { recursive: true });
            }

            const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            whatsappLogger.info(`Using Baileys version ${version.join('.')}, isLatest: ${isLatest}`);

            const sock = makeWASocket({
                version,
                logger: baileysLogger,
                printQRInTerminal: false,
                auth: {
                    creds: authState.creds,
                    keys: makeCacheableSignalKeyStore(authState.keys, baileysLogger),
                },
                browser: ['CRM Educacional', 'Chrome', '1.0.0'],
                markOnlineOnConnect: true,
            });

            this.state.socket = sock;

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // QR Code received
                if (qr) {
                    whatsappLogger.info('QR Code received');
                    this.state.qrCode = await QRCode.toDataURL(qr);
                    this.state.status = 'qr';
                    messageQueue.addLog('QR Code gerado. Escaneie com seu WhatsApp.', 'info');

                    // Emit QR code via Socket.io
                    emitWhatsAppStatus({
                        status: 'qr',
                        qr: this.state.qrCode
                    });

                    // Notify via callback
                    if (this.statusCallback) {
                        this.statusCallback({
                            status: 'qr',
                            qrCode: this.state.qrCode
                        });
                    }
                }

                // Connection opened
                if (connection === 'open') {
                    whatsappLogger.info('🟢 BAILEYS CONNECTED!');
                    this.state.status = 'ready';
                    this.state.qrCode = null;
                    this.state.isReconnecting = false;
                    this.state.isInitializing = false;

                    // Reset reconnect attempts on successful connection
                    this.reconnectAttempts = 0;

                    // Get phone number
                    const user = sock.user;
                    if (user) {
                        this.state.phoneNumber = user.id.split(':')[0];
                        whatsappLogger.info(`Connected phone: ${this.state.phoneNumber}`);
                    }

                    messageQueue.addLog('✅ WhatsApp conectado com sucesso!', 'success');

                    // Emit status update via Socket.io
                    emitWhatsAppStatus({
                        status: 'ready',
                        phoneNumber: this.state.phoneNumber || undefined
                    });

                    // Notify via callback
                    if (this.statusCallback) {
                        this.statusCallback({
                            status: 'ready',
                            phoneNumber: this.state.phoneNumber || undefined
                        });
                    }
                }

                // Connection closed
                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

                    // Status codes that require session reset (no reconnect)
                    const REQUIRE_SESSION_RESET = [
                        DisconnectReason.loggedOut,
                        DisconnectReason.badSession,
                        440, // Session conflict
                    ];

                    const shouldResetSession = REQUIRE_SESSION_RESET.includes(statusCode || 0);
                    const shouldReconnect = !shouldResetSession && statusCode !== DisconnectReason.loggedOut;

                    whatsappLogger.warn(`Connection closed. Code: ${statusCode}, shouldReconnect: ${shouldReconnect}`);

                    this.state.status = 'disconnected';
                    this.state.qrCode = null;
                    this.state.isInitializing = false;

                    // Emit disconnected status via Socket.io
                    emitWhatsAppStatus({
                        status: 'disconnected'
                    });

                    // Notify via callback
                    if (this.statusCallback) {
                        this.statusCallback({
                            status: 'disconnected'
                        });
                    }

                    if (shouldResetSession) {
                        // Session invalidated - need to login again
                        whatsappLogger.info('Session invalidated. Clearing session...');
                        messageQueue.addLog('⚠️ Sessão invalidada. Reconecte o WhatsApp.', 'error');
                        await this.clearSession(false);
                        this.state.isReconnecting = false;
                        this.reconnectAttempts = 0;
                        return;
                    }

                    if (shouldReconnect && !this.state.isReconnecting) {
                        this.reconnectAttempts++;

                        if (this.reconnectAttempts > RECONNECT_CONFIG.maxAttempts) {
                            whatsappLogger.error(`Max reconnection attempts (${RECONNECT_CONFIG.maxAttempts}) reached. Giving up.`);
                            messageQueue.addLog(`❌ Máximo de tentativas de reconexão atingido (${RECONNECT_CONFIG.maxAttempts}). Clique em conectar para tentar novamente.`, 'error');
                            this.state.isReconnecting = false;
                            this.reconnectAttempts = 0;
                            return;
                        }

                        // Calculate delay with exponential backoff
                        const delay = Math.min(
                            RECONNECT_CONFIG.baseDelayMs * Math.pow(2, this.reconnectAttempts - 1),
                            RECONNECT_CONFIG.maxDelayMs
                        );

                        this.state.isReconnecting = true;
                        whatsappLogger.info(`Reconnection attempt ${this.reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts} in ${delay / 1000}s...`);
                        messageQueue.addLog(`Reconectando (tentativa ${this.reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts})...`, 'info');

                        this.reconnectTimeout = setTimeout(() => {
                            this.state.isReconnecting = false;
                            this.initialize();
                        }, delay);
                    }
                }
            });

            // Handle credentials update
            sock.ev.on('creds.update', saveCreds);

            // Handle incoming messages
            sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;

                for (const msg of m.messages) {
                    // Process ALL messages (both received and sent)
                    // This ensures messages sent from WhatsApp app also appear in CRM

                    // Extract message content
                    const messageContent = msg.message?.conversation
                        || msg.message?.extendedTextMessage?.text
                        || '';

                    if (!messageContent) continue;

                    const from = msg.key.remoteJid || '';
                    const isGroup = from.endsWith('@g.us');

                    whatsappLogger.debug(`Message from ${from} (fromMe: ${msg.key.fromMe}): ${messageContent.substring(0, 50)}...`);

                    // Call external handler if registered
                    if (this.messageCallback) {
                        this.messageCallback({
                            from: from.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', ''),
                            body: messageContent,
                            isGroup,
                            timestamp: new Date((msg.messageTimestamp as number) * 1000),
                            fromMe: msg.key.fromMe || false,
                            id: msg.key.id || ''
                        });
                    }
                }
            });

        } catch (error) {
            whatsappLogger.error('Failed to initialize Baileys:', error);
            this.state.status = 'disconnected';
            this.state.isInitializing = false;
            messageQueue.addLog(`Falha ao inicializar: ${error instanceof Error ? error.message : String(error)}`, 'error');
            throw error;
        }
    }

    async restart(): Promise<void> {
        whatsappLogger.info('Restarting Baileys connection...');

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        this.state.isReconnecting = false;
        this.reconnectAttempts = 0;

        if (this.state.socket) {
            this.state.socket.end(undefined);
            this.state.socket = null;
        }

        await this.initialize();
    }

    async logout(): Promise<void> {
        whatsappLogger.info('Logging out from Baileys...');

        if (this.state.socket) {
            await this.state.socket.logout();
            this.state.socket = null;
        }

        await this.clearSession(false);

        this.state.status = 'disconnected';
        this.state.phoneNumber = null;
        this.state.qrCode = null;

        messageQueue.addLog('WhatsApp desconectado', 'info');
    }

    async clearSession(autoReconnect = true): Promise<void> {
        whatsappLogger.info(`Clearing Baileys session... (autoReconnect: ${autoReconnect})`);

        // Remove session files
        if (fs.existsSync(SESSION_PATH)) {
            fs.rmSync(SESSION_PATH, { recursive: true, force: true });
            whatsappLogger.info('Session files removed');
        }

        this.state.status = 'disconnected';
        this.state.phoneNumber = null;
        this.state.qrCode = null;

        if (autoReconnect) {
            await this.initialize();
        }
    }

    // ========================================================================
    // STATUS & CONNECTION
    // ========================================================================

    async getStatus(): Promise<WhatsAppStatusResponse> {
        return {
            status: this.state.status,
            qrCode: this.state.qrCode || undefined,
            phoneNumber: this.state.phoneNumber || undefined
        };
    }

    async isReady(): Promise<boolean> {
        return this.state.socket !== null && this.state.status === 'ready';
    }

    // ========================================================================
    // MESSAGING - TEXTO
    // ========================================================================

    async sendTextMessage(phone: string, message: string): Promise<SendMessageResult> {
        return this.sendMessage(phone, message);
    }

    // ========================================================================
    // MESSAGING - MÍDIA
    // ========================================================================

    async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResult> {
        return this.sendMessage(phone, caption || '', imageUrl, 'image');
    }

    async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResult> {
        return this.sendMessage(phone, caption || '', videoUrl, 'video');
    }

    async sendAudio(phone: string, audioUrl: string, ptt?: boolean): Promise<SendMessageResult> {
        return this.sendMessage(phone, '', audioUrl, 'audio');
    }

    async sendDocument(phone: string, documentUrl: string, filename?: string): Promise<SendMessageResult> {
        return this.sendMessage(phone, filename || '', documentUrl, 'document');
    }



    protected formatToDefaultJid(number: string): string {
        return `${number}@s.whatsapp.net`;
    }

    protected async verifyJidOnNetwork(number: string): Promise<string | null> {
        if (!this.state.socket) return null;

        const jid = this.formatToDefaultJid(number);

        try {
            const results = await this.state.socket.onWhatsApp(jid);
            const result = results?.[0];

            if (result?.exists) {
                return result.jid;
            }
        } catch (e) {
            whatsappLogger.warn(`Baileys onWhatsApp failed for ${jid}`, e);
        }
        return null;
    }

    async sendMessage(
        phone: string,
        message: string,
        mediaUrl?: string,
        mediaType?: MediaType
    ): Promise<SendMessageResult> {
        if (!this.state.socket || this.state.status !== 'ready') {
            return {
                success: false,
                error: 'WhatsApp não está conectado'
            };
        }

        try {
            // Resolve correct JID using network check
            const jid = await this.getChatId(phone);

            let sentMsg;

            if (mediaUrl) {
                // Send media message
                if (mediaUrl.match(/\.(jpg|jpeg|png|gif)$/i) || mediaType === 'image') {
                    sentMsg = await this.state.socket.sendMessage(jid, {
                        image: { url: mediaUrl },
                        caption: message
                    });
                } else if (mediaUrl.match(/\.(mp4|mov|avi)$/i) || mediaType === 'video') {
                    sentMsg = await this.state.socket.sendMessage(jid, {
                        video: { url: mediaUrl },
                        caption: message
                    });
                } else {
                    // Default to document
                    sentMsg = await this.state.socket.sendMessage(jid, {
                        document: { url: mediaUrl },
                        mimetype: 'application/octet-stream',
                        fileName: mediaUrl.split('/').pop() || 'file',
                        caption: message
                    });
                }
            } else {
                // Send text message
                sentMsg = await this.state.socket.sendMessage(jid, {
                    text: message
                });
            }

            return {
                success: true,
                messageId: sentMsg?.key?.id || undefined
            };
        } catch (error) {
            whatsappLogger.error('Error sending message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao enviar mensagem'
            };
        }
    }

    // ========================================================================
    // CONTACTS & PROFILE
    // ========================================================================

    async getProfilePicture(phone: string): Promise<string | null> {
        if (!this.state.socket) return null;

        try {
            const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            const profilePicUrl = await this.state.socket.profilePictureUrl(jid, 'image');
            return profilePicUrl || null;
        } catch (error) {
            whatsappLogger.debug(`No profile picture for ${phone}`);
            return null;
        }
    }

    async validateNumber(phone: string): Promise<string | null> {
        if (!this.state.socket) return null;

        try {
            const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            const results = await this.state.socket.onWhatsApp(jid);
            const result = results?.[0];

            if (result?.exists) {
                return result.jid.split('@')[0];
            }

            return null;
        } catch (error) {
            whatsappLogger.error('Error validating number:', error);
            return null;
        }
    }

    async getContactInfo(phone: string): Promise<ContactInfo | null> {
        if (!this.state.socket) return null;

        try {
            const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

            // Get profile picture
            const profilePicture = await this.getProfilePicture(phone);

            // Baileys doesn't provide easy access to contact name
            // Would need to implement contact store
            return {
                profilePicture: profilePicture || undefined
            };
        } catch (error) {
            whatsappLogger.error('Error getting contact info:', error);
            return null;
        }
    }

    // ========================================================================
    // EVENTS
    // ========================================================================

    onMessage(callback: MessageCallback): void {
        this.messageCallback = callback;
    }

    onStatusChange(callback: StatusCallback): void {
        this.statusCallback = callback;
    }

    offMessage(): void {
        this.messageCallback = null;
    }

    offStatusChange(): void {
        this.statusCallback = null;
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    getProviderName(): string {
        return 'Baileys';
    }

    getProviderVersion(): string {
        return '6.7.0'; // Update with actual Baileys version
    }
}
