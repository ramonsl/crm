"use strict";
/**
 * Baileys WhatsApp Client Implementation
 *
 * Alternative to whatsapp-web.js using @whiskeysockets/baileys
 * More stable and doesn't rely on browser automation
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
exports.baileysState = void 0;
exports.initializeBaileys = initializeBaileys;
exports.getBaileysStatus = getBaileysStatus;
exports.isBaileysReady = isBaileysReady;
exports.sendBaileysMessage = sendBaileysMessage;
exports.getBaileysProfilePicture = getBaileysProfilePicture;
exports.validateBaileysNumber = validateBaileysNumber;
exports.logoutBaileys = logoutBaileys;
exports.clearSession = clearSession;
exports.onBaileysMessage = onBaileysMessage;
exports.restartBaileys = restartBaileys;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const fs = __importStar(require("fs"));
const pino_1 = __importDefault(require("pino"));
const logger_1 = require("../../lib/logger");
const messageQueue_1 = require("../../lib/messageQueue");
const db_1 = require("../db");
const QRCode = __importStar(require("qrcode"));
const emitter_1 = require("../../lib/socket/emitter");
// Session path configuration
const SESSION_PATH = process.env.NODE_ENV === 'production'
    ? '/tmp/baileys-session'
    : './.baileys_auth';
// Pino logger for Baileys (silent most logs)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baileysLogger = pino_1.default({ level: 'silent' });
// Reconnection control
const RECONNECT_CONFIG = {
    maxAttempts: 5,
    baseDelayMs: 5000,
    maxDelayMs: 60000,
};
let reconnectAttempts = 0;
let reconnectTimeout = null;
const state = {
    socket: null,
    status: 'disconnected',
    qrCode: null,
    phoneNumber: null,
    isReconnecting: false,
    isInitializing: false
};
exports.baileysState = state;
let onMessageCallback = null;
/**
 * Initialize Baileys WhatsApp client
 */
async function initializeBaileys() {
    // Prevent multiple simultaneous initializations
    if (state.isInitializing) {
        logger_1.whatsappLogger.debug('Baileys is already initializing, skipping...');
        return;
    }
    if (state.socket && state.status === 'ready') {
        logger_1.whatsappLogger.debug('Baileys already initialized and ready');
        return;
    }
    // Clear any pending reconnect timeout
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    // Cleanup existing socket before creating new one
    if (state.socket) {
        logger_1.whatsappLogger.info('Destroying existing socket before reinitializing...');
        try {
            state.socket.end(undefined);
        }
        catch (_a) {
            // Ignore cleanup errors
        }
        state.socket = null;
    }
    state.isInitializing = true;
    logger_1.whatsappLogger.info('Initializing Baileys WhatsApp Client...');
    messageQueue_1.messageQueue.addLog('Inicializando cliente WhatsApp (Baileys)...', 'info');
    state.status = 'initializing';
    try {
        // Ensure session directory exists
        if (!fs.existsSync(SESSION_PATH)) {
            fs.mkdirSync(SESSION_PATH, { recursive: true });
        }
        // Load auth state
        const { state: authState, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(SESSION_PATH);
        // Fetch latest version
        const { version, isLatest } = await (0, baileys_1.fetchLatestBaileysVersion)();
        logger_1.whatsappLogger.info(`Using Baileys version ${version.join('.')}, isLatest: ${isLatest}`);
        // Create socket with optimized configuration for stability
        const sock = (0, baileys_1.default)({
            version,
            logger: baileysLogger,
            printQRInTerminal: false, // We handle QR ourselves
            auth: {
                creds: authState.creds,
                keys: (0, baileys_1.makeCacheableSignalKeyStore)(authState.keys, baileysLogger)
            },
            generateHighQualityLinkPreview: false, // Reduce API calls
            markOnlineOnConnect: false, // Don't mark as online immediately (reduces conflicts)
            syncFullHistory: false, // Don't sync history to reduce load
            getMessage: async () => undefined // Required for retries
        });
        state.socket = sock;
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            var _a, _b;
            const { connection, lastDisconnect, qr } = update;
            // QR Code received
            if (qr) {
                logger_1.whatsappLogger.info('QR Code received');
                state.qrCode = await QRCode.toDataURL(qr);
                state.status = 'initializing';
                messageQueue_1.messageQueue.addLog('QR Code gerado. Escaneie com seu WhatsApp.', 'info');
                // Emit QR code via Socket.io
                (0, emitter_1.emitWhatsAppStatus)({
                    status: 'qr',
                    qr: state.qrCode
                });
            }
            // Connection opened
            if (connection === 'open') {
                logger_1.whatsappLogger.info('🟢 BAILEYS CONNECTED!');
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
                    logger_1.whatsappLogger.info(`Connected phone: ${state.phoneNumber}`);
                }
                messageQueue_1.messageQueue.addLog('✅ WhatsApp conectado com sucesso!', 'success');
                // Emit status update via Socket.io
                (0, emitter_1.emitWhatsAppStatus)({
                    status: 'ready',
                    phoneNumber: state.phoneNumber || undefined
                });
            }
            // Connection closed
            if (connection === 'close') {
                const statusCode = (_b = (_a = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode;
                // Status codes that require session reset (no reconnect)
                const REQUIRE_SESSION_RESET = [
                    baileys_1.DisconnectReason.loggedOut,
                    401, // Unauthorized
                ];
                // Status codes that indicate stream conflict (longer delay before reconnect)
                const STREAM_CONFLICT_CODES = [
                    440, // Stream Replaced - another device took over
                    baileys_1.DisconnectReason.connectionReplaced,
                ];
                const shouldResetSession = REQUIRE_SESSION_RESET.includes(statusCode);
                const isStreamConflict = STREAM_CONFLICT_CODES.includes(statusCode);
                const shouldReconnect = !shouldResetSession;
                logger_1.whatsappLogger.warn(`Connection closed. Status: ${statusCode}. ShouldReconnect: ${shouldReconnect}. StreamConflict: ${isStreamConflict}`);
                state.status = 'disconnected';
                state.qrCode = null;
                state.isInitializing = false;
                // Emit disconnected status via Socket.io
                (0, emitter_1.emitWhatsAppStatus)({
                    status: 'disconnected'
                });
                if (shouldResetSession) {
                    // Session invalidated - need to login again
                    logger_1.whatsappLogger.info('Session invalidated. Clearing session...');
                    messageQueue_1.messageQueue.addLog('Sessão expirada. Escaneie o QR code novamente.', 'info');
                    reconnectAttempts = 0;
                    await clearSession();
                    return;
                }
                if (isStreamConflict) {
                    // Stream conflict - another device is active
                    // DO NOT auto-reconnect, as this will cause an infinite loop
                    // User must manually click "Connect" after closing other session
                    logger_1.whatsappLogger.warn('Stream conflict detected (code 440). Another WhatsApp session is active (phone, web, or another app). NOT auto-reconnecting to avoid loop.');
                    messageQueue_1.messageQueue.addLog('⚠️ Conflito de sessão! Outra sessão do WhatsApp está ativa. Feche a outra sessão e clique em Conectar.', 'error');
                    // Keep status as disconnected, don't auto-reconnect
                    state.isReconnecting = false;
                    reconnectAttempts = 0;
                    return;
                }
                if (shouldReconnect && !state.isReconnecting) {
                    reconnectAttempts++;
                    if (reconnectAttempts > RECONNECT_CONFIG.maxAttempts) {
                        logger_1.whatsappLogger.error(`Max reconnection attempts (${RECONNECT_CONFIG.maxAttempts}) reached. Giving up.`);
                        messageQueue_1.messageQueue.addLog(`❌ Máximo de tentativas de reconexão atingido (${RECONNECT_CONFIG.maxAttempts}). Clique em conectar para tentar novamente.`, 'error');
                        state.isReconnecting = false;
                        reconnectAttempts = 0;
                        return;
                    }
                    // Calculate delay with exponential backoff
                    const delay = Math.min(RECONNECT_CONFIG.baseDelayMs * Math.pow(2, reconnectAttempts - 1), RECONNECT_CONFIG.maxDelayMs);
                    state.isReconnecting = true;
                    logger_1.whatsappLogger.info(`Reconnection attempt ${reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts} in ${delay / 1000}s...`);
                    messageQueue_1.messageQueue.addLog(`Reconectando (tentativa ${reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts})...`, 'info');
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
            var _a, _b, _c;
            if (m.type !== 'notify')
                return;
            for (const msg of m.messages) {
                // Process ALL messages (both received and sent)
                // This ensures messages sent from WhatsApp app also appear in CRM
                // Extract message content
                const messageContent = ((_a = msg.message) === null || _a === void 0 ? void 0 : _a.conversation)
                    || ((_c = (_b = msg.message) === null || _b === void 0 ? void 0 : _b.extendedTextMessage) === null || _c === void 0 ? void 0 : _c.text)
                    || '';
                if (!messageContent)
                    continue;
                const from = msg.key.remoteJid || '';
                const isGroup = from.endsWith('@g.us');
                logger_1.whatsappLogger.debug(`Message from ${from} (fromMe: ${msg.key.fromMe}): ${messageContent.substring(0, 50)}...`);
                // Call external handler if registered
                if (onMessageCallback) {
                    onMessageCallback({
                        from: from.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', ''),
                        body: messageContent,
                        isGroup,
                        timestamp: new Date(msg.messageTimestamp * 1000),
                        fromMe: msg.key.fromMe || false,
                        id: msg.key.id || ''
                    });
                }
            }
        });
    }
    catch (error) {
        logger_1.whatsappLogger.error('Failed to initialize Baileys:', error);
        state.status = 'disconnected';
        state.isInitializing = false;
        messageQueue_1.messageQueue.addLog(`Falha ao inicializar: ${error instanceof Error ? error.message : String(error)}`, 'error');
        throw error;
    }
}
/**
 * Get current connection status
 */
function getBaileysStatus() {
    return {
        status: state.status,
        qrCode: state.qrCode,
        phoneNumber: state.phoneNumber
    };
}
/**
 * Check if client is ready
 */
function isBaileysReady() {
    return state.socket !== null && state.status === 'ready';
}
/**
 * Wait for connection to be ready
 */
async function waitForConnection(timeoutMs = 10000) {
    if (state.status === 'ready')
        return;
    logger_1.whatsappLogger.info(`Waiting for WhatsApp connection (current: ${state.status})...`);
    // If disconnected and not initializing/reconnecting, we can't wait
    if (state.status === 'disconnected' && !state.isInitializing && !state.isReconnecting) {
        return;
    }
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        // Cast to string to avoid TS assuming state doesn't change
        if (state.status === 'ready')
            return;
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
async function sendBaileysMessage(phone, message, mediaUrl) {
    var _a;
    // Try to wait if initializing
    if (state.status === 'initializing' || state.isReconnecting) {
        try {
            await waitForConnection(15000); // Wait up to 15s
        }
        catch (e) {
            logger_1.whatsappLogger.warn(`Wait for connection failed: ${e}`);
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
    logger_1.whatsappLogger.debug(`Sending message to ${jid}`);
    messageQueue_1.messageQueue.addLog(`Enviando para ${phone}...`, 'info');
    try {
        // Check if number exists on WhatsApp
        const checkResult = await state.socket.onWhatsApp(jid);
        let exists = checkResult === null || checkResult === void 0 ? void 0 : checkResult[0];
        if (!(exists === null || exists === void 0 ? void 0 : exists.exists)) {
            // Try with 9th digit for Brazilian numbers
            if (jid.startsWith('55') && !jid.includes('9', 4)) {
                const withNine = jid.substring(0, 4) + '9' + jid.substring(4);
                const checkWithNine = await state.socket.onWhatsApp(withNine);
                const existsWithNine = checkWithNine === null || checkWithNine === void 0 ? void 0 : checkWithNine[0];
                if (existsWithNine === null || existsWithNine === void 0 ? void 0 : existsWithNine.exists) {
                    jid = existsWithNine.jid;
                    exists = existsWithNine;
                }
                else {
                    throw new Error(`Número ${phone} não possui WhatsApp`);
                }
            }
            else {
                throw new Error(`Número ${phone} não possui WhatsApp`);
            }
        }
        else {
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
            }
            else if (mediaUrl.match(/\.(mp4|mov|avi)$/i)) {
                sendResult = await state.socket.sendMessage(jid, {
                    video: { url: mediaUrl },
                    caption: message
                });
            }
            else {
                sendResult = await state.socket.sendMessage(jid, {
                    document: { url: mediaUrl },
                    mimetype: 'application/octet-stream',
                    fileName: mediaUrl.split('/').pop() || 'file',
                    caption: message
                });
            }
        }
        else {
            // Send text only
            sendResult = await state.socket.sendMessage(jid, { text: message });
        }
        const msgId = ((_a = sendResult === null || sendResult === void 0 ? void 0 : sendResult.key) === null || _a === void 0 ? void 0 : _a.id) || 'unknown';
        logger_1.whatsappLogger.info(`Message sent successfully. ID: ${msgId}`);
        messageQueue_1.messageQueue.addLog(`✅ Mensagem enviada! ID: ${msgId}`, 'success');
        // Update lead's last message
        try {
            const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
            await db_1.pool.query('UPDATE leads SET last_message_time = NOW(), last_message = $1 WHERE telefone = $2 OR telefone = $3', [`(Enviada) ${message}`, phone, phoneWithoutCountry]);
        }
        catch (dbError) {
            logger_1.whatsappLogger.error('Error updating last_message_time:', dbError);
        }
        return { success: true, id: msgId };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.whatsappLogger.error(`Failed to send message: ${errorMessage}`);
        messageQueue_1.messageQueue.addLog(`❌ Erro: ${errorMessage}`, 'error');
        throw error;
    }
}
/**
 * Get profile picture URL
 */
async function getBaileysProfilePicture(phone) {
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
    }
    catch (_a) {
        return null;
    }
}
/**
 * Validate if number is on WhatsApp
 */
async function validateBaileysNumber(phone) {
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
        const exists = checkResult === null || checkResult === void 0 ? void 0 : checkResult[0];
        if (exists === null || exists === void 0 ? void 0 : exists.exists) {
            return exists.jid;
        }
        // Try with 9th digit
        if (jid.startsWith('55') && !jid.includes('9', 4)) {
            const withNine = jid.substring(0, 4) + '9' + jid.substring(4);
            const checkWithNine = await state.socket.onWhatsApp(withNine);
            const existsWithNine = checkWithNine === null || checkWithNine === void 0 ? void 0 : checkWithNine[0];
            if (existsWithNine === null || existsWithNine === void 0 ? void 0 : existsWithNine.exists) {
                return existsWithNine.jid;
            }
        }
        return null;
    }
    catch (_a) {
        return null;
    }
}
/**
 * Logout and disconnect
 */
async function logoutBaileys() {
    if (state.socket) {
        try {
            await state.socket.logout();
        }
        catch (e) {
            logger_1.whatsappLogger.error('Error logging out:', e);
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
async function clearSession() {
    if (state.socket) {
        try {
            state.socket.end(undefined);
        }
        catch (_a) {
            // Ignore
        }
        state.socket = null;
    }
    // Delete session files
    try {
        if (fs.existsSync(SESSION_PATH)) {
            fs.rmSync(SESSION_PATH, { recursive: true, force: true });
        }
    }
    catch (e) {
        logger_1.whatsappLogger.error('Error clearing session:', e);
    }
    state.status = 'disconnected';
    state.qrCode = null;
    state.phoneNumber = null;
}
/**
 * Register message handler callback
 */
function onBaileysMessage(callback) {
    onMessageCallback = callback;
}
/**
 * Restart client
 */
async function restartBaileys() {
    logger_1.whatsappLogger.info('Restarting Baileys client...');
    if (state.socket) {
        try {
            state.socket.end(undefined);
        }
        catch (_a) {
            // Ignore
        }
        state.socket = null;
    }
    state.status = 'disconnected';
    await initializeBaileys();
}
