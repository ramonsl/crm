/**
 * WPPConnect Provider Adapter
 * 
 * Implementa IWhatsAppProvider usando @wppconnect-team/wppconnect
 */

import * as fs from 'fs';
import * as path from 'path';
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

const SESSION_PATH = './.wppconnect_auth';

// Declare webpack global for TS
declare const __non_webpack_require__: any;

// Dynamic import holder
let wppconnect: any;

export class WPPConnectAdapter implements IWhatsAppProvider {
    private client: any | null = null;
    private status: WhatsAppStatus = 'disconnected';
    private qrCode: string | null = null;
    private phoneNumber: string | null = null;
    private messageCallback: MessageCallback | null = null;
    private statusCallback: StatusCallback | null = null;
    private isInitializing: boolean = false;

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    async initialize(): Promise<void> {
        if (this.isInitializing) {
            whatsappLogger.warn('WPPConnect already initializing...');
            return;
        }

        if (this.status === 'ready') {
            whatsappLogger.info('WPPConnect already initialized and ready');
            return;
        }

        this.isInitializing = true;
        this.status = 'connecting';

        try {
            whatsappLogger.info('Initializing WPPConnect Client...');

            // Dynamically load wppconnect to avoid build issues (Webpack/Turbopack scan)
            if (!wppconnect) {
                try {
                    // Use eval('require') to completely hide the dependency from the bundler
                    const requireFunc = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : eval('require');
                    wppconnect = requireFunc('@wppconnect-team/wppconnect');
                } catch (e) {
                    console.error('Failed to load @wppconnect-team/wppconnect', e);
                    throw new Error('Failed to load WPPConnect library. Make sure it is installed.');
                }
            }

            // Ensure session directory exists
            if (!fs.existsSync(SESSION_PATH)) {
                fs.mkdirSync(SESSION_PATH, { recursive: true });
            }

            // Create client with specific options to avoid build/runtime issues
            this.client = await wppconnect.create({
                session: 'crm-session',
                folderNameToken: SESSION_PATH,
                headless: true, // Headless chrome
                devtools: false,
                useChrome: true,
                debug: false,
                logQR: false,
                browserArgs: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ],
                disableWelcome: true,
                updatesLog: false,
                autoClose: 0,
                tokenStore: 'file',
                catchQR: (base64Qr: any, asciiQR: any, attempts: any, urlCode: any) => {
                    this.status = 'qr';
                    this.qrCode = base64Qr;

                    whatsappLogger.info('QR Code received');
                    messageQueue.addLog('QR Code gerado. Escaneie com seu WhatsApp.', 'info');

                    // Emit via socket
                    emitWhatsAppStatus({
                        status: 'qr',
                        qr: base64Qr
                    });

                    if (this.statusCallback) {
                        this.statusCallback({ status: 'qr', qrCode: base64Qr });
                    }
                },
                statusFind: (statusSession: any, session: any) => {
                    whatsappLogger.info(`Status session: ${statusSession}`);

                    if (statusSession === 'inChat' || statusSession === 'isLogged') {
                        this.handleConnectionSuccess();
                    }

                    if (statusSession === 'browserClose' || statusSession === 'qrReadFail' || statusSession === 'autocloseCalled') {
                        this.status = 'disconnected';
                        this.client = null;
                    }
                }
            });

            this.handleConnectionSuccess();

        } catch (error) {
            whatsappLogger.error('Failed to initialize WPPConnect:', error);
            this.status = 'disconnected';
            this.isInitializing = false;
            messageQueue.addLog(`Falha ao inicializar: ${error instanceof Error ? error.message : String(error)}`, 'error');
            throw error;
        }
    }

    private async handleConnectionSuccess() {
        if (!this.client) return;

        this.status = 'ready';
        this.qrCode = null;
        this.isInitializing = false;

        const device = await this.client.getHostDevice();
        this.phoneNumber = device?.wid?._serialized?.split('@')[0] || null;

        whatsappLogger.info(`🟢 WPPCONNECT CONNECTED! Phone: ${this.phoneNumber}`);
        messageQueue.addLog('✅ WhatsApp conectado com sucesso!', 'success');

        // Setup listeners
        this.setupListeners();

        // Emit status
        emitWhatsAppStatus({
            status: 'ready',
            phoneNumber: this.phoneNumber || undefined
        });

        if (this.statusCallback) {
            this.statusCallback({
                status: 'ready',
                phoneNumber: this.phoneNumber || undefined
            });
        }
    }

    private setupListeners() {
        if (!this.client) return;

        this.client.onMessage(async (message: any) => {
            if (!this.messageCallback) return;

            // Normalize message
            const normalizedMsg: WhatsAppMessage = {
                from: message.from.split('@')[0],
                body: message.body || message.caption || '',
                isGroup: message.isGroupMsg,
                timestamp: new Date(message.timestamp * 1000),
                fromMe: message.fromMe,
                id: message.id,
                mediaUrl: undefined, // Handle media extraction if needed
                mediaType: message.type === 'chat' ? undefined : message.type as MediaType
            };

            this.messageCallback(normalizedMsg);
        });
    }

    async restart(): Promise<void> {
        await this.logout();
        await this.initialize();
    }

    async logout(): Promise<void> {
        if (this.client) {
            await this.client.close();
        }
        this.client = null;
        this.status = 'disconnected';
        this.phoneNumber = null;
        this.qrCode = null;
        this.isInitializing = false;
    }

    async clearSession(autoReconnect = true): Promise<void> {
        if (this.client) {
            await this.client.logout();
            await this.client.close();
        }

        // Remove session folder
        if (fs.existsSync(SESSION_PATH)) {
            fs.rmSync(SESSION_PATH, { recursive: true, force: true });
        }

        this.client = null;
        this.status = 'disconnected';
        this.isInitializing = false;

        if (autoReconnect) {
            await this.initialize();
        }
    }

    // ========================================================================
    // STATUS & CONNECTION
    // ========================================================================

    async getStatus(): Promise<WhatsAppStatusResponse> {
        return {
            status: this.status,
            qrCode: this.qrCode || undefined,
            phoneNumber: this.phoneNumber || undefined
        };
    }

    async isReady(): Promise<boolean> {
        return this.status === 'ready' && this.client !== null;
    }

    // ========================================================================
    // MESSAGING
    // ========================================================================

    async sendTextMessage(phone: string, message: string): Promise<SendMessageResult> {
        return this.sendMessage(phone, message);
    }

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

    async sendMessage(
        phone: string,
        message: string,
        mediaUrl?: string,
        mediaType?: MediaType
    ): Promise<SendMessageResult> {
        if (!this.client || this.status !== 'ready') {
            return { success: false, error: 'WhatsApp não está conectado' };
        }

        try {
            // WPPConnect uses number@c.us for contacts
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            let result;

            if (mediaUrl) {
                // Send media
                if (mediaType === 'image' || mediaUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
                    result = await this.client.sendImage(chatId, mediaUrl, 'image', message);
                } else if (mediaType === 'video' || mediaUrl.match(/\.(mp4)$/i)) {
                    result = await this.client.sendFile(chatId, mediaUrl, 'video', message);
                } else if (mediaType === 'audio') {
                    result = await this.client.sendPtt(chatId, mediaUrl);
                } else {
                    result = await this.client.sendFile(chatId, mediaUrl, 'file', message);
                }
            } else {
                // Send text
                result = await this.client.sendText(chatId, message);
            }

            return {
                success: true,
                messageId: typeof result === 'object' ? (result as any).id : String(result)
            };

        } catch (error) {
            whatsappLogger.error('Error sending message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // CONTACTS
    // ========================================================================

    async getProfilePicture(phone: string): Promise<string | null> {
        if (!this.client) return null;
        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const result = await this.client.getProfilePicFromServer(chatId);
            return (result as any)?.url || (result as any)?.eurl || null;
        } catch (e) {
            return null;
        }
    }

    async validateNumber(phone: string): Promise<string | null> {
        if (!this.client) return null;
        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const result = await this.client.checkNumberStatus(chatId);
            return result.numberExists ? result.id._serialized.split('@')[0] : null;
        } catch (e) {
            return null;
        }
    }

    async getContactInfo(phone: string): Promise<ContactInfo | null> {
        const pic = await this.getProfilePicture(phone);
        return { profilePicture: pic || undefined };
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
        return 'WPPConnect';
    }

    getProviderVersion(): string {
        return '1.0.0';
    }
}
