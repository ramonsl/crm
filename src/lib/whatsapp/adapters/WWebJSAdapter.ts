/**
 * WWebJS (whatsapp-web.js) WhatsApp Provider Adapter
 * 
 * Implementa IWhatsAppProvider usando whatsapp-web.js
 * Migrado de index.ts para seguir padrão de abstração
 */

import { Client, RemoteAuth, Message as WWebMessage } from 'whatsapp-web.js';
import { PostgresStore } from '../store/PostgresStore';
import * as QRCode from 'qrcode';
import { whatsappLogger } from '@/lib/logger';
import { emitWhatsAppStatus } from '@/lib/socket/emitter';
import type {
    IWhatsAppProvider,
    WhatsAppMessage,
    WhatsAppStatusResponse,
    SendMessageResult,
    ContactInfo,
    MessageCallback,
    StatusCallback,
    LogCallback,
    WhatsAppStatus,
    MediaType,
    GroupMetadata,
    GroupParticipant
} from '../IWhatsAppProvider';
import { BaseWhatsAppAdapter } from './BaseWhatsAppAdapter';

interface WWebJSState {
    client: Client | null;
    status: WhatsAppStatus;
    qrCode: string | null;
    phoneNumber: string | null;
    isInitializing: boolean;
}

export class WWebJSAdapter extends BaseWhatsAppAdapter implements IWhatsAppProvider {
    private state: WWebJSState = {
        client: null,
        status: 'disconnected',
        qrCode: null,
        phoneNumber: null,
        isInitializing: false,
    };

    private messageCallback: MessageCallback | null = null;
    private statusCallback: StatusCallback | null = null;
    private logCallback: LogCallback | null = null;

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    async initialize(): Promise<void> {
        console.log('[WWebJS] 🚀 initialize() called');

        if (this.state.isInitializing) {
            console.log('[WWebJS] ⚠️ Already initializing, skipping');
            whatsappLogger.warn('WWebJS already initializing...');
            return;
        }

        if (this.state.status === 'ready') {
            console.log('[WWebJS] ✅ Already ready, skipping');
            whatsappLogger.info('WWebJS already initialized and ready');
            return;
        }

        this.state.isInitializing = true;
        this.state.status = 'connecting';
        console.log('[WWebJS] 📡 Status set to connecting');

        try {
            whatsappLogger.info('Initializing WWebJS WhatsApp Client...');

            // ALWAYS destroy existing client before creating new one
            if (this.state.client) {
                console.log('[WWebJS] 🗑️ Destroying existing client');
                whatsappLogger.debug('Existing client found. Destroying before fresh init...');
                try {
                    await this.state.client.destroy();
                } catch (e) {
                    whatsappLogger.error('Error destroying existing client:', e);
                }
                this.state.client = null;
            }

            // Kill any existing Chrome processes for this session
            console.log('[WWebJS] 🔫 Killing old Chrome processes');
            try {
                const { execSync } = require('child_process');
                execSync('pkill -f "chrome.*wwebjs"', { stdio: 'ignore' });
                whatsappLogger.info('Cleaned up old Chrome processes');
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            // Remove lock files that might prevent initialization
            const sessionPath = './.wwebjs_auth';
            console.log('[WWebJS] 🔓 Removing lock files from:', sessionPath);
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

            console.log('[WWebJS] 🏗️ Creating new Client instance');
            const client = new Client({
                authStrategy: new RemoteAuth({
                    clientId: 'main-production',
                    store: new PostgresStore(),
                    backupSyncIntervalMs: 600000,
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
            console.log('[WWebJS] ✅ Client instance created and stored');

            // ========================================================================
            // CRITICAL: Register ALL event handlers BEFORE initialize()
            // ========================================================================

            console.log('[WWebJS] 📋 Registering event handlers...');

            // QR Code event
            client.on('qr', async (qr) => {
                console.log('[WWebJS] 📱 QR CODE EVENT FIRED!');
                whatsappLogger.info('QR Code received');
                this.state.qrCode = await QRCode.toDataURL(qr);
                this.state.status = 'qr';
                console.log('[WWebJS] ✅ QR Code converted to data URL, status = qr');
                this.log('QR Code gerado. Escaneie com seu WhatsApp.', 'info');

                // Emit via Socket.io
                console.log('[WWebJS] 📡 Emitting QR via Socket.io');
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
                console.log('[WWebJS] ✅ QR Code event handled completely');
            });

            // Ready event
            client.on('ready', () => {
                console.log('[WWebJS] 🟢 READY EVENT FIRED!');
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

                this.log('✅ WhatsApp conectado com sucesso!', 'success');

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
                console.log('[WWebJS] 🔴 DISCONNECTED EVENT FIRED! Reason:', reason);
                whatsappLogger.warn(`WWebJS disconnected: ${reason}`);
                this.state.status = 'disconnected';
                this.state.qrCode = null;
                this.state.isInitializing = false;

                this.log('⚠️ WhatsApp desconectado', 'info');

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
                    // Resolve LID to real phone number (ensure consistency with Baileys)
                    let fromPhone = msg.from.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');

                    // If it's a LID (very long number not starting with country code), try to get real number
                    if (fromPhone.length > 15 && !fromPhone.startsWith('55')) {
                        // WWebJS can get the real number from contact
                        try {
                            const contactNumber = contact.number;
                            if (contactNumber && contactNumber.length <= 15) {
                                whatsappLogger.debug(`Resolved LID ${fromPhone} to ${contactNumber}`);
                                fromPhone = contactNumber;
                            }
                        } catch (e) {
                            whatsappLogger.warn(`Could not resolve LID to phone: ${fromPhone}`);
                        }
                    }

                    this.messageCallback({
                        from: fromPhone,
                        body: msg.body,
                        isGroup: chat.isGroup,
                        timestamp: new Date(msg.timestamp * 1000),
                        fromMe: msg.fromMe,
                        id: msg.id._serialized
                    });
                }
            });

            console.log('[WWebJS] ✅ All event handlers registered');

            // ========================================================================
            // NOW initialize (after all handlers are registered)
            // ========================================================================
            console.log('[WWebJS] 🎬 Calling client.initialize()...');
            client.initialize().catch(err => {
                console.log('[WWebJS] ❌ Initialize FAILED:', err);
                whatsappLogger.error('Failed to initialize client:', err);
                this.log(`Falha ao inicializar: ${err instanceof Error ? err.message : String(err)}`, 'error');
                this.state.status = 'disconnected';
                this.state.isInitializing = false;
            });

            console.log('[WWebJS] ✅ initialize() method completed (client running in background)');

        } catch (error) {
            console.log('[WWebJS] ❌ EXCEPTION in initialize():', error);
            whatsappLogger.error('Failed to initialize WWebJS:', error);
            this.state.status = 'disconnected';
            this.state.isInitializing = false;
            this.log(`Falha ao inicializar: ${error instanceof Error ? error.message : String(error)}`, 'error');
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

        if (!this.state.client) {
            whatsappLogger.info('No client to logout from');
            this.state.status = 'disconnected';
            this.state.phoneNumber = null;
            this.state.qrCode = null;
            return;
        }

        try {
            await this.state.client.logout();
            await this.state.client.destroy();
        } catch (error) {
            whatsappLogger.error('Error during logout:', error);
        }

        this.state.client = null;
        this.state.status = 'disconnected';
        this.state.phoneNumber = null;
        this.state.qrCode = null;
        this.state.isInitializing = false;

        this.log('WhatsApp desconectado', 'info');
    }

    async clearSession(autoReconnect = true): Promise<void> {
        whatsappLogger.info(`Clearing WWebJS session... (autoReconnect: ${autoReconnect})`);

        this.state.isInitializing = false; // Force reset flag

        if (this.state.client) {
            try {
                await this.state.client.destroy();
            } catch (e) {
                // ignore
            }
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
            const chatId = await this.getChatId(phone);
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
            const chatId = await this.getChatId(phone);
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
            const chatId = await this.getChatId(phone);
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
            const chatId = await this.getChatId(phone);
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

    // ========================================================================
    // BASE CLASS IMPLEMENTATIONS
    // ========================================================================

    protected formatToDefaultJid(number: string): string {
        return `${number}@c.us`;
    }

    protected async verifyJidOnNetwork(number: string): Promise<string | null> {
        if (!this.state.client) return null;

        const jid = this.formatToDefaultJid(number);

        try {
            const isRegistered = await this.state.client.isRegisteredUser(jid);
            if (isRegistered) {
                // WWebJS returns boolean, so we reconstruct the JID or query numberId
                // Better to verify exact ID if possible, but isRegisteredUser is robust for WWebJS
                // Let's try getContactById to get serialized ID
                const contact = await this.state.client.getContactById(jid);
                return contact ? contact.id._serialized : jid;
            }
        } catch (error) {
            whatsappLogger.warn(`WWebJS checkNumberStatus failed for ${jid}`, error);
        }
        return null;
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
            const chatId = await this.getChatId(phone);

            if (mediaUrl) {
                if (mediaType === 'image') {
                    return this.sendImage(chatId, mediaUrl, message);
                } else if (mediaType === 'video') {
                    return this.sendVideo(chatId, mediaUrl, message);
                } else if (mediaType === 'audio') {
                    return this.sendAudio(chatId, mediaUrl);
                } else {
                    return this.sendDocument(chatId, mediaUrl, message);
                }
            } else {
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
    // GROUPS
    // ========================================================================

    async listGroups(): Promise<GroupMetadata[]> {
        if (!this.state.client || this.state.status !== 'ready') return [];

        try {
            const chats = await this.state.client.getChats();
            const groups = chats.filter(c => c.isGroup);

            return groups.map(g => ({
                id: g.id._serialized,
                subject: g.name,
                description: undefined, // WWebJS definition of Chat doesn't always have description synchronously
                creation: new Date(g.timestamp * 1000),
                owner: undefined,
                participants: [] // Fetching participants for all groups might be heavy, returning empty by default for list
            }));
        } catch (error) {
            whatsappLogger.error('Error listing groups:', error);
            return [];
        }
    }

    async getGroupParticipants(groupId: string): Promise<GroupParticipant[]> {
        if (!this.state.client || this.state.status !== 'ready') return [];

        try {
            const chat = await this.state.client.getChatById(groupId);
            if (!chat.isGroup) return [];

            return (chat as any).participants.map((p: any) => ({
                id: p.id._serialized,
                admin: p.isAdmin,
                superAdmin: p.isSuperAdmin
            }));

        } catch (error) {
            whatsappLogger.error(`Error getting participants for ${groupId}:`, error);
            return [];
        }
    }

    async isNumberInGroup(phone: string, groupId: string): Promise<boolean> {
        if (!this.state.client || this.state.status !== 'ready') return false;

        try {
            const participants = await this.getGroupParticipants(groupId);
            const jid = phone.includes('@') ? phone : `${phone}@c.us`;
            return participants.some(p => p.id === jid);
        } catch (error) {
            whatsappLogger.error(`Error checking if ${phone} is in ${groupId}:`, error);
            return false;
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

    onLog(callback: LogCallback): void {
        this.logCallback = callback;
    }

    offMessage(): void {
        this.messageCallback = null;
    }

    offStatusChange(): void {
        this.statusCallback = null;
    }

    offLog(): void {
        this.logCallback = null;
    }

    private log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        if (this.logCallback) {
            this.logCallback(message, type);
        }
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
