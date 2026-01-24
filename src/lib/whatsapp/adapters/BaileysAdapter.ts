/**
 * Baileys WhatsApp Provider Adapter
 * 
 * Implementa IWhatsAppProvider usando @whiskeysockets/baileys
 * Migrado de baileys.ts para seguir padrão de abstração
 */

import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket,
    downloadMediaMessage,
    proto
} from '@whiskeysockets/baileys';
import { createPostgresAuthState, clearPostgresSession } from '../store/BaileysPostgresAuth';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { whatsappLogger } from '@/lib/logger';
import { emitWhatsAppStatus, emitWhatsAppHistorySync } from '@/lib/socket/emitter';
import * as QRCode from 'qrcode';
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
    GroupParticipant,
    HistorySyncCallback
} from '../IWhatsAppProvider';
import { BaseWhatsAppAdapter } from './BaseWhatsAppAdapter';

// Session path configuration
const SESSION_PATH = process.env.NODE_ENV === 'production'
    ? '/tmp/baileys-session'
    : path.resolve(process.cwd(), '.baileys_auth');

// Pino logger for Baileys (silent most logs)
const baileysLogger = pino({ level: 'silent' });

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
    private logCallback: LogCallback | null = null;
    private historySyncCallback: HistorySyncCallback | null = null;

    // LID to Phone mapping cache (LIDs are temporary WhatsApp identifiers)
    private lidToPhoneMap: Map<string, string> = new Map();

    // ========================================================================
    // MEDIA HELPERS
    // ========================================================================

    /**
     * Download media from a Baileys message
     */
    private async downloadMedia(msg: proto.IWebMessageInfo, sock: WASocket): Promise<Buffer | null> {
        try {
            const buffer = await downloadMediaMessage(
                msg as import('@whiskeysockets/baileys').WAMessage,
                'buffer',
                {},
                {
                    logger: baileysLogger,
                    reuploadRequest: sock.updateMediaMessage
                }
            );
            return buffer as Buffer;
        } catch (error) {
            whatsappLogger.error('Error downloading media:', error);
            return null;
        }
    }

    /**
     * Save media buffer to file and return URL
     */
    private async saveMediaToFile(buffer: Buffer, type: string, ext: string): Promise<string> {
        const { v4: uuidv4 } = await import('uuid');
        const filename = `${uuidv4()}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat');

        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, buffer);

        return `/uploads/chat/${filename}`;
    }

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

            // Ensure session directory exists (kept for compatibility or media cache if needed)
            if (!fs.existsSync(SESSION_PATH)) {
                fs.mkdirSync(SESSION_PATH, { recursive: true });
            }

            // Use Postgres Auth State
            const { state: authState, saveCreds } = await createPostgresAuthState('main-production');
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
                    this.log('QR Code gerado. Escaneie com seu WhatsApp.', 'info');

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

                    this.log('✅ WhatsApp conectado com sucesso!', 'success');

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
                        this.log('⚠️ Sessão invalidada. Reconecte o WhatsApp.', 'error');
                        await this.clearSession(false);
                        this.state.isReconnecting = false;
                        this.reconnectAttempts = 0;
                        return;
                    }

                    if (shouldReconnect && !this.state.isReconnecting) {
                        this.reconnectAttempts++;

                        if (this.reconnectAttempts > RECONNECT_CONFIG.maxAttempts) {
                            whatsappLogger.error(`Max reconnection attempts (${RECONNECT_CONFIG.maxAttempts}) reached. Giving up.`);
                            this.log(`❌ Máximo de tentativas de reconexão atingido (${RECONNECT_CONFIG.maxAttempts}). Clique em conectar para tentar novamente.`, 'error');
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
                        this.log(`Reconectando (tentativa ${this.reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts})...`, 'info');

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
                    const rawJid = msg.key.remoteJid || '';
                    const isGroup = rawJid.endsWith('@g.us');

                    // Resolve LID to real phone number
                    // Baileys sometimes returns @lid identifiers instead of real phone numbers
                    let from = rawJid;

                    // Check if this is a Link ID (LID)
                    if (rawJid.includes('@lid')) {
                        // Try alternative JID fields provided by Baileys
                        const altJid = (msg.key as { remoteJidAlt?: string }).remoteJidAlt;
                        if (altJid && altJid.includes('@s.whatsapp.net')) {
                            from = altJid;
                            whatsappLogger.debug(`Resolved LID via remoteJidAlt: ${rawJid} -> ${altJid}`);
                        } else {
                            // Check for cached mapping
                            const lidClean = rawJid.replace('@lid', '');
                            const cachedPhone = this.lidToPhoneMap.get(lidClean);
                            if (cachedPhone) {
                                from = cachedPhone + '@s.whatsapp.net';
                                whatsappLogger.debug(`Resolved LID via cache: ${rawJid} -> ${from}`);
                            } else {
                                // Log warning - this LID couldn't be resolved
                                whatsappLogger.warn(`Could not resolve LID to phone: ${rawJid}. Message may appear in wrong chat.`);
                            }
                        }
                    }

                    // Extract message content and media info
                    let messageContent = '';
                    let mediaUrl: string | undefined;
                    let mediaType: MediaType | undefined;

                    const message = msg.message;
                    if (!message) continue;

                    // Text messages
                    if (message.conversation) {
                        messageContent = message.conversation;
                    } else if (message.extendedTextMessage?.text) {
                        messageContent = message.extendedTextMessage.text;
                    }
                    // Image messages
                    else if (message.imageMessage) {
                        messageContent = message.imageMessage.caption || '[Imagem]';
                        mediaType = 'image';
                        try {
                            const buffer = await this.downloadMedia(msg, sock);
                            if (buffer) {
                                mediaUrl = await this.saveMediaToFile(buffer, 'image', 'jpg');
                            }
                        } catch (e) {
                            whatsappLogger.error('Error downloading image:', e);
                        }
                    }
                    // Video messages
                    else if (message.videoMessage) {
                        messageContent = message.videoMessage.caption || '[Vídeo]';
                        mediaType = 'video';
                        try {
                            const buffer = await this.downloadMedia(msg, sock);
                            if (buffer) {
                                mediaUrl = await this.saveMediaToFile(buffer, 'video', 'mp4');
                            }
                        } catch (e) {
                            whatsappLogger.error('Error downloading video:', e);
                        }
                    }
                    // Audio messages
                    else if (message.audioMessage) {
                        messageContent = '[Áudio]';
                        mediaType = 'audio';
                        try {
                            const buffer = await this.downloadMedia(msg, sock);
                            if (buffer) {
                                const ext = message.audioMessage.mimetype?.includes('ogg') ? 'ogg' : 'mp3';
                                mediaUrl = await this.saveMediaToFile(buffer, 'audio', ext);
                            }
                        } catch (e) {
                            whatsappLogger.error('Error downloading audio:', e);
                        }
                    }
                    // Document messages
                    else if (message.documentMessage) {
                        messageContent = message.documentMessage.fileName || '[Documento]';
                        mediaType = 'document';
                        try {
                            const buffer = await this.downloadMedia(msg, sock);
                            if (buffer) {
                                const ext = path.extname(message.documentMessage.fileName || '.bin').slice(1) || 'bin';
                                mediaUrl = await this.saveMediaToFile(buffer, 'document', ext);
                            }
                        } catch (e) {
                            whatsappLogger.error('Error downloading document:', e);
                        }
                    }
                    // Sticker messages
                    else if (message.stickerMessage) {
                        messageContent = '[Sticker]';
                        mediaType = 'image';
                        try {
                            const buffer = await this.downloadMedia(msg, sock);
                            if (buffer) {
                                mediaUrl = await this.saveMediaToFile(buffer, 'image', 'webp');
                            }
                        } catch (e) {
                            whatsappLogger.error('Error downloading sticker:', e);
                        }
                    }

                    // Skip if no content
                    if (!messageContent && !mediaUrl) continue;

                    whatsappLogger.debug(`Message from ${from} (fromMe: ${msg.key.fromMe}): ${messageContent.substring(0, 50)}...`);

                    // Call external handler if registered
                    if (this.messageCallback) {
                        this.messageCallback({
                            from: from.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', ''),
                            body: messageContent,
                            isGroup,
                            timestamp: new Date((msg.messageTimestamp as number) * 1000),
                            fromMe: msg.key.fromMe || false,
                            id: msg.key.id || '',
                            mediaUrl,
                            mediaType
                        });
                    }
                }
            });

            // Handle history synchronization (initial dump of contacts and chat metadata)
            sock.ev.on('messaging-history.set', async ({ chats, contacts, isLatest }) => {
                whatsappLogger.info(`📜 History metadata received: ${chats.length} chats, ${contacts.length} contacts (isLatest: ${isLatest})`);

                emitWhatsAppHistorySync({ progress: 50, status: 'Sincronizando lista de conversas...' });

                const { LeadRepository } = await import('@/lib/repositories');
                const leadRepo = new LeadRepository();

                // Process contacts to ensure leads exist
                for (const contact of contacts) {
                    const phone = contact.id.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
                    // Skip groups and invalid phones
                    if (phone && !phone.includes('-') && !phone.includes('@g.us')) {
                        try {
                            const existing = await leadRepo.findByPhone(phone);
                            if (!existing) {
                                await leadRepo.create({
                                    cpf: phone,
                                    nome: contact.notify || contact.name || phone,
                                    telefone: phone,
                                    status: 'Novo Lead'
                                });
                            }
                        } catch (e) {
                            whatsappLogger.error(`Error syncing contact ${phone}:`, e);
                        }
                    }
                }

                // Process chats to update last message/unread count
                // Process chats to update last message/unread count
                for (const chat of chats) {
                    if (!chat.id) continue;
                    const phone = chat.id.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
                    if (phone && !chat.id.endsWith('@g.us')) {
                        try {
                            const lastMsgInfo = chat.messages?.[0] as proto.IWebMessageInfo | undefined;
                            const msgContent = lastMsgInfo?.message;

                            const lastMsg = msgContent?.conversation ||
                                msgContent?.extendedTextMessage?.text ||
                                '[Mensagem]';

                            const timestamp = lastMsgInfo?.messageTimestamp
                                ? new Date((Number(lastMsgInfo?.messageTimestamp)) * 1000).toISOString()
                                : new Date().toISOString();

                            await leadRepo.updateLastMessage(phone, lastMsg, timestamp);
                        } catch (e) {
                            whatsappLogger.error(`Error updating chat metadata for ${phone}:`, e);
                        }
                    }
                }

                whatsappLogger.info('✅ History metadata sync completed');
                emitWhatsAppHistorySync({ progress: 100, status: 'Lista de conversas atualizada!' });
            });

        } catch (error) {
            whatsappLogger.error('Failed to initialize Baileys:', error);
            this.state.status = 'disconnected';
            this.state.isInitializing = false;
            this.log(`Falha ao inicializar: ${error instanceof Error ? error.message : String(error)}`, 'error');
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
            try {
                await this.state.socket.logout();
            } catch (e) {
                whatsappLogger.warn('Error during socket logout:', e);
            }
            // Force end connection
            this.state.socket.end(undefined);
            this.state.socket = null;
        }

        // Small delay to ensure events settle
        await new Promise(resolve => setTimeout(resolve, 100));

        await this.clearSession(false);

        this.state.status = 'disconnected';
        this.state.phoneNumber = null;
        this.state.qrCode = null;

        this.log('WhatsApp desconectado', 'info');
    }

    async clearSession(autoReconnect = true): Promise<void> {
        whatsappLogger.info(`Clearing Baileys session... (autoReconnect: ${autoReconnect})`);

        // Clear Postgres Session
        try {
            await clearPostgresSession('main-production');
            whatsappLogger.info('Postgres session cleared');
        } catch (e) {
            whatsappLogger.error('Failed to clear Postgres session:', e);
        }

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

    async syncChatHistory(phone: string): Promise<void> {
        if (!this.state.socket || this.state.status !== 'ready') return;

        const jid = this.formatToDefaultJid(phone);
        whatsappLogger.info(`🔄 Requesting history sync for ${phone}...`);

        try {
            // Fetch the last 50 messages from WhatsApp servers
            // Fetch the last 50 messages from WhatsApp servers
            // Casting to unknown first to safely access extended custom methods not in base WASocket type
            const sock = this.state.socket as unknown as {
                fetchMessagesFromWA(jid: string, count: number, cursor: undefined): Promise<proto.IWebMessageInfo[]>
            };
            const result = await sock.fetchMessagesFromWA(jid, 50, undefined);

            if (result && result.length > 0) {
                const { WhatsAppRepository } = await import('@/lib/repositories');
                const repo = new WhatsAppRepository();

                const messagesToSave = result.map((m) => {
                    let content = '';
                    const msg = m.message;
                    if (msg) {
                        if (msg.conversation) content = msg.conversation;
                        else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
                        else if (msg.imageMessage) content = '[Imagem]';
                        else if (msg.videoMessage) content = '[Vídeo]';
                        else content = '[Mídia/Outro]';
                    }

                    return {
                        id: m.key?.id || `sync_${Date.now()}_${Math.random()}`,
                        contact_phone: phone,
                        content: content || '[Histórico]',
                        from_me: m.key?.fromMe || false,
                        type: 'text',
                        timestamp: new Date((m.messageTimestamp as number) * 1000)
                    };
                });

                await repo.saveMessagesBulk(messagesToSave);
                whatsappLogger.info(`✅ Successfully synced ${result.length} messages for ${phone}`);
            }
        } catch (error) {
            whatsappLogger.error(`Error syncing history for ${phone}:`, error);
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
    // GROUPS
    // ========================================================================

    async listGroups(): Promise<GroupMetadata[]> {
        if (!this.state.socket || this.state.status !== 'ready') return [];

        try {
            // Baileys method to get all groups the user is participating in
            const groupsDict = await this.state.socket.groupFetchAllParticipating();
            const groups = Object.values(groupsDict);

            return groups.map(g => ({
                id: g.id,
                subject: g.subject,
                description: g.desc,
                creation: new Date((g.creation || 0) * 1000),
                owner: g.owner,
                participants: g.participants.map(p => ({
                    id: p.id.split('@')[0], // Remove suffix for cleaner ID
                    admin: p.admin === 'admin',
                    superAdmin: p.admin === 'superadmin'
                }))
            }));
        } catch (error) {
            whatsappLogger.error('Error listing groups:', error);
            return [];
        }
    }

    async getGroupParticipants(groupId: string): Promise<GroupParticipant[]> {
        if (!this.state.socket || this.state.status !== 'ready') return [];

        try {
            const metadata = await this.state.socket.groupMetadata(groupId);
            return metadata.participants.map(p => ({
                id: p.id.split('@')[0],
                admin: p.admin === 'admin',
                superAdmin: p.admin === 'superadmin'
            }));

        } catch (error) {
            whatsappLogger.error(`Error getting participants for ${groupId}:`, error);
            return [];
        }
    }

    async isNumberInGroup(phone: string, groupId: string): Promise<boolean> {
        if (!this.state.socket || this.state.status !== 'ready') return false;

        try {
            const participants = await this.getGroupParticipants(groupId);
            // Ensure phone is just numbers (no suffix)
            const cleanPhone = phone.split('@')[0];
            return participants.some(p => p.id === cleanPhone);
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

    onHistorySync(callback: HistorySyncCallback): void {
        this.historySyncCallback = callback;
    }

    offHistorySync(): void {
        this.historySyncCallback = null;
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
        return 'Baileys';
    }

    getProviderVersion(): string {
        return '6.7.0'; // Update with actual Baileys version
    }
}
