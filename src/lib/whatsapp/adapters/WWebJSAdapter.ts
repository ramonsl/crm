/**
 * WWebJS (whatsapp-web.js) WhatsApp Provider Adapter
 * 
 * Implementa IWhatsAppProvider usando whatsapp-web.js
 * Migrado de index.ts para seguir padrão de abstração
 */

import { Client, LocalAuth, Message as WWebMessage } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import { whatsappLogger } from '@/lib/logger';
import { messageQueue } from '@/lib/messageQueue';
import { emitWhatsAppStatus } from '@/lib/socket/emitter';
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

interface WWebJSState {
    client: Client | null;
    status: WhatsAppStatus;
    qrCode: string | null;
    phoneNumber: string | null;
    isInitializing: boolean;
}

export class WWebJSAdapter implements IWhatsAppProvider {
    private state: WWebJSState = {
        client: null,
        status: 'disconnected',
        qrCode: null,
        phoneNumber: null,
        isInitializing: false,
    };

    private messageCallback: MessageCallback | null = null;
    private statusCallback: StatusCallback | null = null;

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    async initialize(): Promise<void> {
        if (this.state.isInitializing) {
            whatsappLogger.warn('WWebJS already initializing...');
            return;
        }

        if (this.state.status === 'ready') {
            whatsappLogger.info('WWebJS already initialized and ready');
            return;
        }

        this.state.isInitializing = true;
        this.state.status = 'connecting';

        try {
            whatsappLogger.info('Initializing WWebJS WhatsApp Client...');

            // ALWAYS destroy existing client before creating new one
            if (this.state.client) {
                whatsappLogger.debug('Existing client found. Destroying before fresh init...');
                try {
                    await this.state.client.destroy();
                } catch (e) {
                    whatsappLogger.error('Error destroying existing client:', e);
                }
                this.state.client = null;
            }

            // Kill any existing Chrome processes for this session
            try {
                const { execSync } = require('child_process');
                execSync('pkill -f "chrome.*wwebjs"', { stdio: 'ignore' });
                whatsappLogger.info('Cleaned up old Chrome processes');
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            // Remove lock files that might prevent initialization
            const sessionPath = './.wwebjs_auth';
            try {
                const fs = require('fs');
                const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
                lockFiles.forEach((lockFile: string) => {
                    const lockPath = `${sessionPath}/session/${lockFile}`;
                    if (fs.existsSync(lockPath)) {
                        fs.unlinkSync(lockPath);
                        whatsappLogger.debug(`Removed lock file: ${lockPath}`);
                    }
                });
            } catch (e) {
                whatsappLogger.warn('Error removing lock files:', e);
            }

            const client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: sessionPath
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox'
                    ]
                }
            });

            this.state.client = client;

            // QR Code event
            client.on('qr', async (qr) => {
                whatsappLogger.info('QR Code received');
                this.state.qrCode = await QRCode.toDataURL(qr);
                this.state.status = 'qr';
                messageQueue.addLog('QR Code gerado. Escaneie com seu WhatsApp.', 'info');

                // Emit via Socket.io
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
            });

            // Ready event
            client.on('ready', () => {
                whatsappLogger.info('🟢 WWEBJS CONNECTED!');
                this.state.status = 'ready';
                this.state.qrCode = null;
                this.state.isInitializing = false;

                // Get phone number
                const info = client.info;
                if (info) {
                    this.state.phoneNumber = info.wid.user;
                    whatsappLogger.info(`Connected phone: ${this.state.phoneNumber}`);
                }

                messageQueue.addLog('✅ WhatsApp conectado com sucesso!', 'success');

                // Emit status update
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
            });

            // Disconnected event
            client.on('disconnected', (reason) => {
                whatsappLogger.warn(`WWebJS disconnected: ${reason}`);
                this.state.status = 'disconnected';
                this.state.qrCode = null;
                this.state.isInitializing = false;

                messageQueue.addLog('⚠️ WhatsApp desconectado', 'info');

                // Emit status update
                emitWhatsAppStatus({
                    status: 'disconnected'
                });

                // Notify via callback
                if (this.statusCallback) {
                    this.statusCallback({
                        status: 'disconnected'
                    });
                }
            });

            // Message event
            client.on('message', async (msg: WWebMessage) => {
                if (msg.fromMe) return; // Ignore own messages

                const contact = await msg.getContact();
                const chat = await msg.getChat();

                whatsappLogger.debug(`Message from ${msg.from}: ${msg.body.substring(0, 50)}...`);

                // Call external handler if registered
                if (this.messageCallback) {
                    this.messageCallback({
                        from: msg.from.replace('@c.us', '').replace('@s.whatsapp.net', ''),
                        body: msg.body,
                        isGroup: chat.isGroup,
                        timestamp: new Date(msg.timestamp * 1000),
                        fromMe: msg.fromMe,
                        id: msg.id._serialized
                    });
                }
            });

            // Initialize client (don't await - let it run in background)
            client.initialize().catch(err => {
                whatsappLogger.error('Failed to initialize client:', err);
                messageQueue.addLog(`Falha ao inicializar: ${err instanceof Error ? err.message : String(err)}`, 'error');
                this.state.status = 'disconnected';
                this.state.isInitializing = false;
            });

        } catch (error) {
            whatsappLogger.error('Failed to initialize WWebJS:', error);
            this.state.status = 'disconnected';
            this.state.isInitializing = false;
            messageQueue.addLog(`Falha ao inicializar: ${error instanceof Error ? error.message : String(error)}`, 'error');
            throw error;
        }
    }

    async restart(): Promise<void> {
        whatsappLogger.info('Restarting WWebJS connection...');

        if (this.state.client) {
            await this.state.client.destroy();
            this.state.client = null;
        }

        this.state.status = 'disconnected';
        await this.initialize();
    }

    async logout(): Promise<void> {
        whatsappLogger.info('Logging out from WWebJS...');

        if (this.state.client) {
            await this.state.client.logout();
            await this.state.client.destroy();
            this.state.client = null;
        }

        this.state.status = 'disconnected';
        this.state.phoneNumber = null;
        this.state.qrCode = null;

        messageQueue.addLog('WhatsApp desconectado', 'info');
    }

    async clearSession(autoReconnect = true): Promise<void> {
        whatsappLogger.info(`Clearing WWebJS session... (autoReconnect: ${autoReconnect})`);

        if (this.state.client) {
            await this.state.client.destroy();
            this.state.client = null;
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
        return this.state.client !== null && this.state.status === 'ready';
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
        if (!this.state.client || this.state.status !== 'ready') {
            return {
                success: false,
                error: 'WhatsApp não está conectado'
            };
        }

        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const { MessageMedia } = await import('whatsapp-web.js');
            const media = await MessageMedia.fromUrl(imageUrl);

            const sentMsg = await this.state.client.sendMessage(chatId, media, {
                caption: caption || ''
            });

            return {
                success: true,
                messageId: sentMsg.id._serialized
            };
        } catch (error) {
            whatsappLogger.error('Error sending image:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao enviar imagem'
            };
        }
    }

    async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResult> {
        if (!this.state.client || this.state.status !== 'ready') {
            return {
                success: false,
                error: 'WhatsApp não está conectado'
            };
        }

        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const { MessageMedia } = await import('whatsapp-web.js');
            const media = await MessageMedia.fromUrl(videoUrl);

            const sentMsg = await this.state.client.sendMessage(chatId, media, {
                caption: caption || ''
            });

            return {
                success: true,
                messageId: sentMsg.id._serialized
            };
        } catch (error) {
            whatsappLogger.error('Error sending video:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao enviar vídeo'
            };
        }
    }

    async sendAudio(phone: string, audioUrl: string, ptt?: boolean): Promise<SendMessageResult> {
        if (!this.state.client || this.state.status !== 'ready') {
            return {
                success: false,
                error: 'WhatsApp não está conectado'
            };
        }

        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const { MessageMedia } = await import('whatsapp-web.js');
            const media = await MessageMedia.fromUrl(audioUrl);

            const sentMsg = await this.state.client.sendMessage(chatId, media, {
                sendAudioAsVoice: ptt || false
            });

            return {
                success: true,
                messageId: sentMsg.id._serialized
            };
        } catch (error) {
            whatsappLogger.error('Error sending audio:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao enviar áudio'
            };
        }
    }

    async sendDocument(phone: string, documentUrl: string, filename?: string): Promise<SendMessageResult> {
        if (!this.state.client || this.state.status !== 'ready') {
            return {
                success: false,
                error: 'WhatsApp não está conectado'
            };
        }

        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const { MessageMedia } = await import('whatsapp-web.js');
            const media = await MessageMedia.fromUrl(documentUrl);

            if (filename) {
                media.filename = filename;
            }

            const sentMsg = await this.state.client.sendMessage(chatId, media);

            return {
                success: true,
                messageId: sentMsg.id._serialized
            };
        } catch (error) {
            whatsappLogger.error('Error sending document:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao enviar documento'
            };
        }
    }

    async sendMessage(
        phone: string,
        message: string,
        mediaUrl?: string,
        mediaType?: MediaType
    ): Promise<SendMessageResult> {
        if (!this.state.client || this.state.status !== 'ready') {
            return {
                success: false,
                error: 'WhatsApp não está conectado'
            };
        }

        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;

            if (mediaUrl) {
                // Send with media
                if (mediaType === 'image') {
                    return this.sendImage(phone, mediaUrl, message);
                } else if (mediaType === 'video') {
                    return this.sendVideo(phone, mediaUrl, message);
                } else if (mediaType === 'audio') {
                    return this.sendAudio(phone, mediaUrl);
                } else {
                    return this.sendDocument(phone, mediaUrl, message);
                }
            } else {
                // Send text only
                const sentMsg = await this.state.client.sendMessage(chatId, message);
                return {
                    success: true,
                    messageId: sentMsg.id._serialized
                };
            }
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
        if (!this.state.client) return null;

        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const profilePicUrl = await this.state.client.getProfilePicUrl(chatId);
            return profilePicUrl || null;
        } catch (error) {
            whatsappLogger.debug(`No profile picture for ${phone}`);
            return null;
        }
    }

    async validateNumber(phone: string): Promise<string | null> {
        if (!this.state.client) return null;

        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const isRegistered = await this.state.client.isRegisteredUser(chatId);

            if (isRegistered) {
                return phone.replace('@c.us', '').replace('@s.whatsapp.net', '');
            }

            return null;
        } catch (error) {
            whatsappLogger.error('Error validating number:', error);
            return null;
        }
    }

    async getContactInfo(phone: string): Promise<ContactInfo | null> {
        if (!this.state.client) return null;

        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const contact = await this.state.client.getContactById(chatId);

            if (!contact) return null;

            const profilePicture = await this.getProfilePicture(phone);

            return {
                name: contact.name,
                pushname: contact.pushname,
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
        return 'WWebJS';
    }

    getProviderVersion(): string {
        return '1.23.0'; // whatsapp-web.js version
    }
}
