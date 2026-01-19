/**
 * Baileys WhatsApp Client Implementation
 * 
 * Alternative to whatsapp-web.js using @whiskeysockets/baileys
 * More stable and doesn't rely on browser automation
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
import type { WhatsAppStatus, WhatsAppStatusResponse, SendMessageResult } from './types';
import { pool } from '../db';
import * as QRCode from 'qrcode';

// Session path configuration
const SESSION_PATH = process.env.NODE_ENV === 'production'
    ? '/tmp/baileys-session'
    : './.baileys_auth';

// Pino logger for Baileys (silent most logs)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baileysLogger = (pino as any)({ level: 'silent' });

// Reconnection control
const RECONNECT_CONFIG = {
    maxAttempts: 5,
    baseDelayMs: 5000,
    maxDelayMs: 60000,
};

let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;

// Global state
interface BaileysState {
    socket: WASocket | null;
    status: WhatsAppStatus;
    qrCode: string | null;
    phoneNumber: string | null;
    isReconnecting: boolean;
    isInitializing: boolean;
}

const state: BaileysState = {
    socket: null,
    status: 'disconnected',
    qrCode: null,
    phoneNumber: null,
    isReconnecting: false,
    isInitializing: false
};

// Event callbacks for external handlers
type MessageCallback = (message: {
    from: string;
    body: string;
    isGroup: boolean;
    timestamp: Date;
    fromMe: boolean;
    id: string;
}) => void;

let onMessageCallback: MessageCallback | null = null;

/**
 * Initialize Baileys WhatsApp client
 */
export async function initializeBaileys(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (state.isInitializing) {
        whatsappLogger.debug('Baileys is already initializing, skipping...');
        return;
    }

    if (state.socket && state.status === 'ready') {
        whatsappLogger.debug('Baileys already initialized and ready');
        return;
    }

    // Clear any pending reconnect timeout
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Cleanup existing socket before creating new one
    if (state.socket) {
        whatsappLogger.info('Destroying existing socket before reinitializing...');
        try {
            state.socket.end(undefined);
        } catch {
            // Ignore cleanup errors
        }
        state.socket = null;
    }

    state.isInitializing = true;
    whatsappLogger.info('Initializing Baileys WhatsApp Client...');
    messageQueue.addLog('Inicializando cliente WhatsApp (Baileys)...', 'info');
    state.status = 'initializing';

    try {
        // Ensure session directory exists
        if (!fs.existsSync(SESSION_PATH)) {
            fs.mkdirSync(SESSION_PATH, { recursive: true });
        }

        // Load auth state
        const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

        // Fetch latest version
        const { version, isLatest } = await fetchLatestBaileysVersion();
        whatsappLogger.info(`Using Baileys version ${version.join('.')}, isLatest: ${isLatest}`);

        // Create socket with optimized configuration for stability
        const sock = makeWASocket({
            version,
            logger: baileysLogger,
            printQRInTerminal: false, // We handle QR ourselves
            auth: {
                creds: authState.creds,
                keys: makeCacheableSignalKeyStore(authState.keys, baileysLogger)
            },
            generateHighQualityLinkPreview: false, // Reduce API calls
            markOnlineOnConnect: false, // Don't mark as online immediately (reduces conflicts)
            syncFullHistory: false, // Don't sync history to reduce load
            getMessage: async () => undefined // Required for retries
        });

        state.socket = sock;

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // QR Code received
            if (qr) {
                whatsappLogger.info('QR Code received');
                state.qrCode = await QRCode.toDataURL(qr);
                state.status = 'initializing';
                messageQueue.addLog('QR Code gerado. Escaneie com seu WhatsApp.', 'info');
            }

            // Connection opened
            if (connection === 'open') {
                whatsappLogger.info('🟢 BAILEYS CONNECTED!');
                state.status = 'ready';
                state.qrCode = null;
                state.isReconnecting = false;
                state.isInitializing = false;

                // Reset reconnect attempts on successful connection
                reconnectAttempts = 0;

                // Get phone number
                const user = sock.user;
                if (user) {
                    state.phoneNumber = user.id.split(':')[0];
                    whatsappLogger.info(`Connected phone: ${state.phoneNumber}`);
                }

                messageQueue.addLog('✅ WhatsApp conectado com sucesso!', 'success');
            }

            // Connection closed
            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

                // Status codes that require session reset (no reconnect)
                const REQUIRE_SESSION_RESET = [
                    DisconnectReason.loggedOut,
                    401, // Unauthorized
                ];

                // Status codes that indicate stream conflict (longer delay before reconnect)
                const STREAM_CONFLICT_CODES = [
                    440, // Stream Replaced - another device took over
                    DisconnectReason.connectionReplaced,
                ];

                const shouldResetSession = REQUIRE_SESSION_RESET.includes(statusCode);
                const isStreamConflict = STREAM_CONFLICT_CODES.includes(statusCode);
                const shouldReconnect = !shouldResetSession;

                whatsappLogger.warn(`Connection closed. Status: ${statusCode}. ShouldReconnect: ${shouldReconnect}. StreamConflict: ${isStreamConflict}`);

                state.status = 'disconnected';
                state.qrCode = null;
                state.isInitializing = false;

                if (shouldResetSession) {
                    // Session invalidated - need to login again
                    whatsappLogger.info('Session invalidated. Clearing session...');
                    messageQueue.addLog('Sessão expirada. Escaneie o QR code novamente.', 'info');
                    reconnectAttempts = 0;
                    await clearSession();
                    return;
                }

                if (isStreamConflict) {
                    // Stream conflict - another device is active
                    // DO NOT auto-reconnect, as this will cause an infinite loop
                    // User must manually click "Connect" after closing other session
                    whatsappLogger.warn('Stream conflict detected (code 440). Another WhatsApp session is active (phone, web, or another app). NOT auto-reconnecting to avoid loop.');
                    messageQueue.addLog('⚠️ Conflito de sessão! Outra sessão do WhatsApp está ativa. Feche a outra sessão e clique em Conectar.', 'error');

                    // Keep status as disconnected, don't auto-reconnect
                    state.isReconnecting = false;
                    reconnectAttempts = 0;
                    return;
                }

                if (shouldReconnect && !state.isReconnecting) {
                    reconnectAttempts++;

                    if (reconnectAttempts > RECONNECT_CONFIG.maxAttempts) {
                        whatsappLogger.error(`Max reconnection attempts (${RECONNECT_CONFIG.maxAttempts}) reached. Giving up.`);
                        messageQueue.addLog(`❌ Máximo de tentativas de reconexão atingido (${RECONNECT_CONFIG.maxAttempts}). Clique em conectar para tentar novamente.`, 'error');
                        state.isReconnecting = false;
                        reconnectAttempts = 0;
                        return;
                    }

                    // Calculate delay with exponential backoff
                    const delay = Math.min(
                        RECONNECT_CONFIG.baseDelayMs * Math.pow(2, reconnectAttempts - 1),
                        RECONNECT_CONFIG.maxDelayMs
                    );

                    state.isReconnecting = true;
                    whatsappLogger.info(`Reconnection attempt ${reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts} in ${delay / 1000}s...`);
                    messageQueue.addLog(`Reconectando (tentativa ${reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts})...`, 'info');

                    reconnectTimeout = setTimeout(() => {
                        state.isReconnecting = false;
                        initializeBaileys();
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
                // Skip messages from self
                if (msg.key.fromMe) continue;

                // Extract message content
                const messageContent = msg.message?.conversation
                    || msg.message?.extendedTextMessage?.text
                    || '';

                if (!messageContent) continue;

                const from = msg.key.remoteJid || '';
                const isGroup = from.endsWith('@g.us');

                whatsappLogger.debug(`Message from ${from}: ${messageContent.substring(0, 50)}...`);

                // Call external handler if registered
                if (onMessageCallback) {
                    onMessageCallback({
                        from: from.replace('@s.whatsapp.net', '').replace('@c.us', ''),
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
        state.status = 'disconnected';
        state.isInitializing = false;
        messageQueue.addLog(`Falha ao inicializar: ${error instanceof Error ? error.message : String(error)}`, 'error');
        throw error;
    }
}

/**
 * Get current connection status
 */
export function getBaileysStatus(): WhatsAppStatusResponse {
    return {
        status: state.status,
        qrCode: state.qrCode,
        phoneNumber: state.phoneNumber
    };
}

/**
 * Check if client is ready
 */
export function isBaileysReady(): boolean {
    return state.socket !== null && state.status === 'ready';
}

/**
 * Wait for connection to be ready
 */
async function waitForConnection(timeoutMs = 10000): Promise<void> {
    if (state.status === 'ready') return;

    whatsappLogger.info(`Waiting for WhatsApp connection (current: ${state.status})...`);

    // If disconnected and not initializing/reconnecting, we can't wait
    if (state.status === 'disconnected' && !state.isInitializing && !state.isReconnecting) {
        return;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        // Cast to string to avoid TS assuming state doesn't change
        if ((state.status as string) === 'ready') return;

        // If it went to disconnected state (and stopped retrying), abort
        if (state.status === 'disconnected' && !state.isInitializing && !state.isReconnecting) {
            throw new Error('WhatsApp desconectado durante a espera.');
        }

        // Wait 500ms
        await new Promise(r => setTimeout(r, 500));
    }

    throw new Error(`Timeout (${timeoutMs}ms) aguardando conexão do WhatsApp.`);
}

/**
 * Send a text message
 */
export async function sendBaileysMessage(
    phone: string,
    message: string,
    mediaUrl?: string
): Promise<SendMessageResult> {
    // Try to wait if initializing
    if (state.status === 'initializing' || state.isReconnecting) {
        try {
            await waitForConnection(15000); // Wait up to 15s
        } catch (e) {
            whatsappLogger.warn(`Wait for connection failed: ${e}`);
        }
    }

    if (!state.socket || state.status !== 'ready') {
        throw new Error(`WhatsApp client not ready (Status: ${state.status})`);
    }

    // Normalize phone number
    let jid = phone.replace(/\D/g, '');

    // Add country code if missing
    if (!jid.startsWith('55') && jid.length <= 11) {
        jid = '55' + jid;
    }

    // Format as WhatsApp JID
    jid = jid + '@s.whatsapp.net';

    whatsappLogger.debug(`Sending message to ${jid}`);
    messageQueue.addLog(`Enviando para ${phone}...`, 'info');

    try {
        // Check if number exists on WhatsApp
        const checkResult = await state.socket.onWhatsApp(jid);
        let exists = checkResult?.[0];

        if (!exists?.exists) {
            // Try with 9th digit for Brazilian numbers
            if (jid.startsWith('55') && !jid.includes('9', 4)) {
                const withNine = jid.substring(0, 4) + '9' + jid.substring(4);
                const checkWithNine = await state.socket.onWhatsApp(withNine);
                const existsWithNine = checkWithNine?.[0];
                if (existsWithNine?.exists) {
                    jid = existsWithNine.jid;
                    exists = existsWithNine;
                } else {
                    throw new Error(`Número ${phone} não possui WhatsApp`);
                }
            } else {
                throw new Error(`Número ${phone} não possui WhatsApp`);
            }
        } else {
            jid = exists.jid;
        }

        // Send message
        let sendResult;
        if (mediaUrl) {
            // Send with media
            if (mediaUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
                sendResult = await state.socket.sendMessage(jid, {
                    image: { url: mediaUrl },
                    caption: message
                });
            } else if (mediaUrl.match(/\.(mp4|mov|avi)$/i)) {
                sendResult = await state.socket.sendMessage(jid, {
                    video: { url: mediaUrl },
                    caption: message
                });
            } else {
                sendResult = await state.socket.sendMessage(jid, {
                    document: { url: mediaUrl },
                    mimetype: 'application/octet-stream',
                    fileName: mediaUrl.split('/').pop() || 'file',
                    caption: message
                });
            }
        } else {
            // Send text only
            sendResult = await state.socket.sendMessage(jid, { text: message });
        }

        const msgId = sendResult?.key?.id || 'unknown';
        whatsappLogger.info(`Message sent successfully. ID: ${msgId}`);
        messageQueue.addLog(`✅ Mensagem enviada! ID: ${msgId}`, 'success');

        // Update lead's last message
        try {
            const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
            await pool.query(
                'UPDATE leads SET last_message_time = NOW(), last_message = $1 WHERE telefone = $2 OR telefone = $3',
                [`(Enviada) ${message}`, phone, phoneWithoutCountry]
            );
        } catch (dbError) {
            whatsappLogger.error('Error updating last_message_time:', dbError);
        }

        return { success: true, id: msgId };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        whatsappLogger.error(`Failed to send message: ${errorMessage}`);
        messageQueue.addLog(`❌ Erro: ${errorMessage}`, 'error');
        throw error;
    }
}

/**
 * Get profile picture URL
 */
export async function getBaileysProfilePicture(phone: string): Promise<string | null> {
    if (!state.socket || state.status !== 'ready') {
        return null;
    }

    let jid = phone.replace(/\D/g, '');
    if (!jid.startsWith('55') && jid.length <= 11) {
        jid = '55' + jid;
    }
    jid = jid + '@s.whatsapp.net';

    try {
        const url = await state.socket.profilePictureUrl(jid, 'image');
        return url || null;
    } catch {
        return null;
    }
}

/**
 * Validate if number is on WhatsApp
 */
export async function validateBaileysNumber(phone: string): Promise<string | null> {
    if (!state.socket || state.status !== 'ready') {
        return null;
    }

    let jid = phone.replace(/\D/g, '');
    if (!jid.startsWith('55') && jid.length <= 11) {
        jid = '55' + jid;
    }
    jid = jid + '@s.whatsapp.net';

    try {
        const checkResult = await state.socket.onWhatsApp(jid);
        const exists = checkResult?.[0];
        if (exists?.exists) {
            return exists.jid;
        }

        // Try with 9th digit
        if (jid.startsWith('55') && !jid.includes('9', 4)) {
            const withNine = jid.substring(0, 4) + '9' + jid.substring(4);
            const checkWithNine = await state.socket.onWhatsApp(withNine);
            const existsWithNine = checkWithNine?.[0];
            if (existsWithNine?.exists) {
                return existsWithNine.jid;
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Logout and disconnect
 */
export async function logoutBaileys(): Promise<void> {
    if (state.socket) {
        try {
            await state.socket.logout();
        } catch (e) {
            whatsappLogger.error('Error logging out:', e);
        }
        state.socket = null;
        state.status = 'disconnected';
        state.qrCode = null;
        state.phoneNumber = null;
    }
}

/**
 * Clear session and restart
 */
export async function clearSession(): Promise<void> {
    if (state.socket) {
        try {
            state.socket.end(undefined);
        } catch {
            // Ignore
        }
        state.socket = null;
    }

    // Delete session files
    try {
        if (fs.existsSync(SESSION_PATH)) {
            fs.rmSync(SESSION_PATH, { recursive: true, force: true });
        }
    } catch (e) {
        whatsappLogger.error('Error clearing session:', e);
    }

    state.status = 'disconnected';
    state.qrCode = null;
    state.phoneNumber = null;
}

/**
 * Register message handler callback
 */
export function onBaileysMessage(callback: MessageCallback): void {
    onMessageCallback = callback;
}

/**
 * Restart client
 */
export async function restartBaileys(): Promise<void> {
    whatsappLogger.info('Restarting Baileys client...');

    if (state.socket) {
        try {
            state.socket.end(undefined);
        } catch {
            // Ignore
        }
        state.socket = null;
    }

    state.status = 'disconnected';
    await initializeBaileys();
}

// Export state for external access
export { state as baileysState };
