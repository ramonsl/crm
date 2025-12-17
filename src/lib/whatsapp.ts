import { Client, LocalAuth, MessageMedia, Chat } from 'whatsapp-web.js';
import { pool } from './db';
import { messageQueue } from './messageQueue';
import { WHATSAPP_CONFIG } from './constants';
import type { WhatsAppMessage, WhatsAppContact, WhatsAppMedia } from './types';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ActivityRepository } from './repositories/ActivityRepository';
import { ActivityService } from '../services/activityService';
import { emitNewMessage, emitContactUpdated, emitNewMessageToPhone } from './socket/emitter';

// Extend Chat type to include group-specific properties
interface GroupChat extends Chat {
    participants?: Array<{
        id: { user: string; _serialized: string };
        isAdmin?: boolean;
    }>;
}

// Activity service for logging timeline events
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

// Define a global type to prevent TypeScript errors
declare global {
    var whatsappClient: Client | null;
    var whatsappQrCode: string | null;
    var whatsappStatus: 'disconnected' | 'initializing' | 'ready';
    var whatsappPhoneNumber: string | null; // Phone number connected
    var whatsappReconnectAttempts: number;
    var whatsappReconnectTimer: NodeJS.Timeout | null;
    var whatsappLastDisconnect: number | null;
    var whatsappHealthCheckTimer: NodeJS.Timeout | null;
    var whatsappRestartHistory: number[]; // Timestamps of recent restarts
}

// Initialize globals if they don't exist
if (!global.whatsappStatus) {
    global.whatsappStatus = 'disconnected';
    global.whatsappQrCode = null;
    global.whatsappClient = null;
    global.whatsappPhoneNumber = null;
    global.whatsappReconnectAttempts = 0;
    global.whatsappReconnectTimer = null;
    global.whatsappLastDisconnect = null;
    global.whatsappHealthCheckTimer = null;
    global.whatsappRestartHistory = [];
}

const addSystemAlert = async (title: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    try {
        await pool.query(
            'INSERT INTO system_notifications (title, message, type) VALUES ($1, $2, $3)',
            [title, message, type]
        );
    } catch (e) {
        console.error('Error adding system alert:', e);
    }
};

/**
 * Attempt to reconnect to WhatsApp with exponential backoff
 * Implements retry logic with increasing delays between attempts
 */
const attemptReconnect = async () => {
    // Clear any existing reconnect timer
    if (global.whatsappReconnectTimer) {
        clearTimeout(global.whatsappReconnectTimer);
        global.whatsappReconnectTimer = null;
    }

    // Check if we've exceeded max attempts
    if (global.whatsappReconnectAttempts >= WHATSAPP_CONFIG.RECONNECT_MAX_ATTEMPTS) {
        console.error('[WhatsApp] ❌ Máximo de tentativas de reconexão atingido. Intervenção manual necessária.');
        messageQueue.addLog(`❌ Falha após ${WHATSAPP_CONFIG.RECONNECT_MAX_ATTEMPTS} tentativas. Reconecte manualmente.`, 'error');
        addSystemAlert(
            'WhatsApp - Reconexão Falhada',
            `Falhou após ${WHATSAPP_CONFIG.RECONNECT_MAX_ATTEMPTS} tentativas. Por favor, reconecte manualmente.`,
            'error'
        );

        // Try to notify admin
        try {
            if (global.whatsappClient) {
                await global.whatsappClient.sendMessage(
                    WHATSAPP_CONFIG.ADMIN_PHONE,
                    `🔴 ALERTA CRÍTICO: WhatsApp falhou após ${WHATSAPP_CONFIG.RECONNECT_MAX_ATTEMPTS} tentativas de reconexão. Intervenção manual necessária.`
                );
            }
        } catch (e) {
            console.error('[WhatsApp] Falha ao notificar admin sobre erro crítico:', e);
        }

        return;
    }

    const attempt = global.whatsappReconnectAttempts;
    const delay = WHATSAPP_CONFIG.RECONNECT_DELAYS_MS[Math.min(attempt, WHATSAPP_CONFIG.RECONNECT_DELAYS_MS.length - 1)];

    console.log(`[WhatsApp] 🔄 Agendando reconexão (tentativa ${attempt + 1}/${WHATSAPP_CONFIG.RECONNECT_MAX_ATTEMPTS}) em ${delay / 1000}s...`);
    messageQueue.addLog(`🔄 Reconexão automática em ${delay / 1000}s (tentativa ${attempt + 1}/${WHATSAPP_CONFIG.RECONNECT_MAX_ATTEMPTS})`, 'info');

    // Notify admin after 3 failed attempts
    if (attempt === 2) {
        console.log('[WhatsApp] ⚠️ Notificando admin sobre problemas de conexão...');
        try {
            if (global.whatsappClient) {
                await global.whatsappClient.sendMessage(
                    WHATSAPP_CONFIG.ADMIN_PHONE,
                    `⚠️ AVISO: WhatsApp está tendo problemas de conexão. ${attempt + 1} tentativas de reconexão até agora.`
                );
            }
        } catch (e) {
            console.error('[WhatsApp] Falha ao notificar admin:', e);
        }
    }

    global.whatsappReconnectTimer = setTimeout(async () => {
        global.whatsappReconnectAttempts++;
        console.log(`[WhatsApp] 🔄 Tentativa de reconexão ${global.whatsappReconnectAttempts}/${WHATSAPP_CONFIG.RECONNECT_MAX_ATTEMPTS}...`);
        messageQueue.addLog(`🔄 Tentando reconectar (${global.whatsappReconnectAttempts}/${WHATSAPP_CONFIG.RECONNECT_MAX_ATTEMPTS})...`, 'info');

        try {
            // Destroy old client if exists
            if (global.whatsappClient) {
                try {
                    await global.whatsappClient.destroy();
                } catch (e) {
                    console.error('[WhatsApp] Erro ao destruir cliente antigo:', e);
                }
                global.whatsappClient = null;
            }

            // Force status reset
            global.whatsappStatus = 'disconnected';
            global.whatsappQrCode = null;

            // Re-initialize client
            console.log('[WhatsApp] Reinicializando cliente...');
            getClient();

            // If initialization succeeds, reconnect attempts will be reset in the 'ready' handler
        } catch (error) {
            console.error('[WhatsApp] Erro durante reconexão:', error);
            // Schedule another attempt
            attemptReconnect();
        }
    }, delay);
};

/**
 * Health check to verify connection is truly alive
 * Runs periodically to detect and fix inconsistent states
 */
const startHealthCheck = () => {
    // Clear any existing health check timer
    if (global.whatsappHealthCheckTimer) {
        clearInterval(global.whatsappHealthCheckTimer);
    }

    console.log(`[WhatsApp] 🏥 Iniciando health check periódico (intervalo: ${WHATSAPP_CONFIG.HEALTH_CHECK_INTERVAL_MS / 60000} minutos)`);

    global.whatsappHealthCheckTimer = setInterval(async () => {
        console.log('[WhatsApp] 🏥 Executando health check...');

        try {
            const isReady = await isClientReady();

            if (!isReady && global.whatsappStatus === 'ready') {
                console.warn('[WhatsApp] ⚠️ Health check detectou inconsistência: status "ready" mas cliente não está CONNECTED');
                messageQueue.addLog('⚠️ Health check: cliente não está realmente conectado. Tentando reconectar...', 'info');

                // Trigger reconnection
                global.whatsappStatus = 'disconnected';
                attemptReconnect();
            } else if (isReady && global.whatsappStatus !== 'ready') {
                console.log('[WhatsApp] ✅ Health check: corrigindo status dessincronizado para "ready"');
                global.whatsappStatus = 'ready';
            } else if (isReady) {
                console.log('[WhatsApp] ✅ Health check: OK - Cliente conectado e funcionando');
            } else {
                console.log('[WhatsApp] 🟡 Health check: Cliente não conectado (esperado se ainda não autenticou)');
            }
        } catch (error) {
            console.error('[WhatsApp] ❌ Erro durante health check:', error);
        }
    }, WHATSAPP_CONFIG.HEALTH_CHECK_INTERVAL_MS);
};

/**
 * Clean up old restart timestamps outside the window
 * Returns true if we're within limits, false if too many restarts
 */
const canRestart = (): boolean => {
    const now = Date.now();
    const windowStart = now - WHATSAPP_CONFIG.RESTART_WINDOW_MS;

    // Filter out old restarts outside the window
    global.whatsappRestartHistory = global.whatsappRestartHistory.filter(ts => ts > windowStart);

    // Check if we're within limits
    if (global.whatsappRestartHistory.length >= WHATSAPP_CONFIG.MAX_RESTARTS_PER_WINDOW) {
        console.error(
            `[WhatsApp] ❌ Muitos restarts detectados! ${global.whatsappRestartHistory.length} restarts nos últimos ${WHATSAPP_CONFIG.RESTART_WINDOW_MS / 60000} minutos.`
        );
        messageQueue.addLog(
            `❌ Loop de restart detectado! ${global.whatsappRestartHistory.length} restarts recentes. Parando para evitar loop infinito.`,
            'error'
        );
        addSystemAlert(
            'WhatsApp - Loop de Restart Detectado',
            `Sistema detectou ${global.whatsappRestartHistory.length} restarts em ${WHATSAPP_CONFIG.RESTART_WINDOW_MS / 60000} minutos. Intervenção manual necessária.`,
            'error'
        );
        return false;
    }

    // Add current restart to history
    global.whatsappRestartHistory.push(now);
    return true;
};

export const getClient = () => {
    // If client exists but is disconnected, destroy it to force fresh init
    if (global.whatsappClient && global.whatsappStatus === 'disconnected') {
        console.log('Client exists but is disconnected. Destroying for fresh init...');
        try {
            global.whatsappClient.destroy();
        } catch (e) {
            console.error('Error destroying stale client:', e);
        }
        global.whatsappClient = null;
    }

    if (!global.whatsappClient) {
        console.log('Initializing WhatsApp Client...');
        messageQueue.addLog('Inicializando cliente WhatsApp...', 'info');
        global.whatsappStatus = 'initializing';

        // Determine session path based on environment
        const getSessionPath = () => {
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
        };

        const sessionPath = getSessionPath();
        console.log(`[WhatsApp] Using session path: ${sessionPath}`);

        global.whatsappClient = new Client({
            authStrategy: new LocalAuth({ dataPath: sessionPath }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        });


        global.whatsappClient.on('qr', (qr) => {
            global.whatsappQrCode = qr;
            global.whatsappStatus = 'initializing';
            console.log('QR RECEIVED');
            messageQueue.addLog('QR Code recebido! Escaneie agora.', 'info');
        });

        global.whatsappClient.on('ready', async () => {
            global.whatsappStatus = 'ready';
            global.whatsappQrCode = null;

            // Capture connected phone number
            try {
                const info = global.whatsappClient?.info;
                if (info && info.wid) {
                    global.whatsappPhoneNumber = info.wid.user;
                    console.log(`[WhatsApp] Connected phone number: ${global.whatsappPhoneNumber}`);
                }
            } catch (e) {
                console.error('[WhatsApp] Error getting connected phone:', e);
            }

            console.log('🟢🟢🟢 CLIENT IS READY! WHATSAPP CONNECTED! 🟢🟢🟢');
            messageQueue.addLog('WhatsApp Conectado e Pronto!', 'success');
            addSystemAlert('WhatsApp Conectado', 'A conexão com o WhatsApp foi estabelecida com sucesso.', 'success');

            // Reset reconnection attempts on successful connection
            if (global.whatsappReconnectAttempts > 0) {
                console.log(`[WhatsApp] ✅ Reconexão bem-sucedida após ${global.whatsappReconnectAttempts} tentativa(s)!`);
                messageQueue.addLog(`✅ Reconectado com sucesso após ${global.whatsappReconnectAttempts} tentativa(s)!`, 'success');
            }
            global.whatsappReconnectAttempts = 0;

            // Clear any pending reconnect timer
            if (global.whatsappReconnectTimer) {
                clearTimeout(global.whatsappReconnectTimer);
                global.whatsappReconnectTimer = null;
            }

            // Start health check monitoring
            startHealthCheck();

            // Send notification to admin
            try {
                const adminPhone = '555181636027@c.us';
                await global.whatsappClient?.sendMessage(adminPhone, '🤖 Sistema CRM: Conexão com WhatsApp estabelecida com sucesso!');
                console.log(`[WhatsApp] Connection notification sent to ${adminPhone}`);
            } catch (e) {
                console.error('[WhatsApp] Failed to send connection notification:', e);
            }
        });

        global.whatsappClient.on('authenticated', () => {
            global.whatsappStatus = 'ready';
            global.whatsappQrCode = null;
            console.log('AUTHENTICATED');
            messageQueue.addLog('Autenticado com sucesso!', 'success');
        });

        global.whatsappClient.on('auth_failure', () => {
            global.whatsappStatus = 'disconnected';
            global.whatsappQrCode = null;
            console.error('AUTHENTICATION FAILURE');
            messageQueue.addLog('Falha na autenticação.', 'error');
            addSystemAlert('Falha na Autenticação', 'O WhatsApp falhou ao autenticar. Por favor, reconecte.', 'error');
            global.whatsappClient = null; // Ensure client is cleared on failure

            // Record disconnect time
            global.whatsappLastDisconnect = Date.now();

            // Attempt automatic reconnection
            console.log('[WhatsApp] Falha de autenticação detectada. Tentando reconectar...');
            attemptReconnect();
        });

        global.whatsappClient.on('disconnected', (reason) => {
            global.whatsappStatus = 'disconnected';
            global.whatsappQrCode = null;
            const reasonStr = reason || 'unknown';
            console.log(`[WhatsApp] Cliente desconectado. Motivo: ${reasonStr}`);
            messageQueue.addLog(`Cliente desconectado. Motivo: ${reasonStr}`, 'error');
            addSystemAlert('WhatsApp Desconectado', `O cliente WhatsApp foi desconectado. Motivo: ${reasonStr}`, 'error');
            global.whatsappClient = null;

            // Record disconnect time
            global.whatsappLastDisconnect = Date.now();

            // Stop health check while disconnected
            if (global.whatsappHealthCheckTimer) {
                clearInterval(global.whatsappHealthCheckTimer);
                global.whatsappHealthCheckTimer = null;
            }

            // Attempt automatic reconnection
            console.log('[WhatsApp] Iniciando reconexão automática...');
            attemptReconnect();
        });

        // Error event listeners for better diagnostics and stability
        global.whatsappClient.on('error', (error) => {
            console.error('[WhatsApp] ❌ Client error:', error);
            messageQueue.addLog(`❌ Erro no cliente: ${error.message || error}`, 'error');

            // Critical errors that should trigger reconnection
            const errorStr = String(error);
            if (errorStr.includes('Protocol error') ||
                errorStr.includes('Session closed') ||
                errorStr.includes('Target closed')) {
                console.error('[WhatsApp] Erro crítico detectado via event "error". Tentando reconectar...');
                attemptReconnect();
            }
        });

        global.whatsappClient.on('remote_session_saved', () => {
            console.log('[WhatsApp] ✅ Sessão remota salva com sucesso');
            messageQueue.addLog('✅ Sessão salva', 'success');
        });

        global.whatsappClient.on('loading_screen', (percent, message) => {
            console.log(`[WhatsApp] 📱 Carregando... ${percent}% - ${message}`);
        });

        global.whatsappClient.on('change_state', (state) => {
            console.log(`[WhatsApp] 🔄 Estado mudou para: ${state}`);
        });

        // Simple message handler - listens to ALL messages (including outgoing)
        console.log('🎯 Registrando event listener para message_create...');
        global.whatsappClient.on('message_create', handleMessageCreate);

        global.whatsappClient.initialize().catch(err => {
            console.error('Failed to initialize client:', err);
            messageQueue.addLog(`Falha ao inicializar: ${err.message}`, 'error');
            global.whatsappStatus = 'disconnected';
            global.whatsappClient = null; // Reset client so we can try again
        });

        // Listen for message acknowledgments (sent, delivered, read)
        global.whatsappClient.on('message_ack', async (msg, ack) => {
            console.log(`[WhatsApp] ACK received for message ${msg.id.id}: ${ack}`);

            let status = 'sent';
            if (ack === 1) status = 'sent';
            else if (ack === 2) status = 'delivered';
            else if (ack >= 3) status = 'read';
            else if (ack === -1) status = 'failed';

            try {
                // Note: Using id column instead of message_id for PostgreSQL schema
                const result = await pool.query('UPDATE messages SET type = $1 WHERE id = $2', [status, msg.id.id]);

                if (result.rowCount && result.rowCount > 0) {
                    console.log(`[WhatsApp] Message ${msg.id.id} updated to status: ${status}`);
                } else {
                    // Sometimes we might not have the message yet (race condition), or it's an old message
                    console.log(`[WhatsApp] Message ${msg.id.id} not found in DB to update status.`);
                }
            } catch (error) {
                console.error('[WhatsApp] Error updating message status:', error);
            }
        });
    }
    return global.whatsappClient;
};

export const getStatus = () => {
    // Try to capture phone number if client is ready but phoneNumber is not set
    if (global.whatsappStatus === 'ready' && !global.whatsappPhoneNumber && global.whatsappClient) {
        try {
            const info = global.whatsappClient.info;
            if (info && info.wid) {
                global.whatsappPhoneNumber = info.wid.user;
                console.log(`[WhatsApp] Captured phone number from existing session: ${global.whatsappPhoneNumber}`);
            }
        } catch (e) {
            console.error('[WhatsApp] Error getting phone from existing session:', e);
        }
    }

    return {
        status: global.whatsappStatus || 'disconnected',
        qrCode: global.whatsappQrCode,
        phoneNumber: global.whatsappPhoneNumber || null
    };
};

/**
 * Verifica se o cliente está realmente pronto, consultando o estado real do cliente
 * Não confia apenas na variável global que pode estar dessincronizada
 */
export const isClientReady = async (): Promise<boolean> => {
    try {
        // Se não há cliente, definitivamente não está pronto
        if (!global.whatsappClient) {
            console.log('[WhatsApp] isClientReady: No client instance');
            return false;
        }

        // Tenta obter o estado real do cliente
        const state = await global.whatsappClient.getState();
        console.log(`[WhatsApp] isClientReady: Client state = ${state}, global status = ${global.whatsappStatus}`);

        // CONNECTED é o estado que indica que está pronto para enviar mensagens
        const isReady = state === 'CONNECTED';

        // Sincronizar a variável global se estiver dessincronizada
        if (isReady && global.whatsappStatus !== 'ready') {
            console.log('[WhatsApp] ⚠️ Status dessincronizado! Cliente está CONNECTED mas global.whatsappStatus não está "ready". Corrigindo...');
            global.whatsappStatus = 'ready';
        } else if (!isReady && global.whatsappStatus === 'ready') {
            console.log('[WhatsApp] ⚠️ Status dessincronizado! global.whatsappStatus está "ready" mas cliente não está CONNECTED. Corrigindo...');
            global.whatsappStatus = 'disconnected';
        }

        return isReady;
    } catch (error) {
        console.error('[WhatsApp] Error checking client state:', error);
        return false;
    }
};

export const restartClient = async () => {
    console.log('[WhatsApp] Restarting client...');
    messageQueue.addLog('Reiniciando cliente WhatsApp...', 'info');

    if (global.whatsappClient) {
        try {
            await global.whatsappClient.destroy();
        } catch (e) {
            console.error('[WhatsApp] Error destroying client:', e);
        }
        global.whatsappClient = null;
        global.whatsappStatus = 'disconnected';
    }

    // Re-initialize
    getClient();
};

export const getContactProfilePicture = async (phone: string): Promise<string | null> => {
    console.log(`[WhatsApp] Attempting to get profile picture for ${phone}`);

    if (!global.whatsappClient || global.whatsappStatus !== 'ready') {
        console.error('[WhatsApp] Client not ready');
        return null;
    }

    try {
        // Format phone number to chatId format
        let formattedPhone = phone.replace(/\D/g, '');

        // Remove leading 0 if present
        if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
        }

        // Add country code if it's a local number (10 or 11 digits)
        if (formattedPhone.length === 10 || formattedPhone.length === 11) {
            formattedPhone = '55' + formattedPhone;
        }

        // Try multiple variations to find the profile picture
        const variations: string[] = [formattedPhone];

        // For Brazilian numbers, try with and without the 9th digit
        if (formattedPhone.startsWith('55') && formattedPhone.length === 13) {
            // Has 9th digit, try without it
            const without9 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
            variations.push(without9);
        } else if (formattedPhone.startsWith('55') && formattedPhone.length === 12) {
            // Doesn't have 9th digit, try with it
            const with9 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
            variations.push(with9);
        }

        console.log(`[WhatsApp] Trying variations for profile pic: ${variations.join(', ')}`);

        // Try each variation
        for (const phoneVariation of variations) {
            try {
                const chatId = `${phoneVariation}@c.us`;
                console.log(`[WhatsApp] Trying profile pic for chatId: ${chatId}`);

                const profilePicUrl = await global.whatsappClient.getProfilePicUrl(chatId);

                if (profilePicUrl) {
                    console.log(`[WhatsApp] ✓ Profile picture found for ${phone} using ${phoneVariation}`);
                    return profilePicUrl;
                }
            } catch (err) {
                // Continue to next variation
                console.log(`[WhatsApp] No picture with variation ${phoneVariation}`);
            }
        }

        console.log(`[WhatsApp] No profile picture available for ${phone} (tried all variations)`);
        return null;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`[WhatsApp] Could not get profile picture for ${phone}: ${errorMessage}`);
        return null;
    }
};

export async function validateWhatsAppNumber(phone: string): Promise<string | null> {
    if (!global.whatsappClient || global.whatsappStatus !== 'ready') {
        return null;
    }

    // Format phone number: remove non-digits
    let formattedPhone = phone.replace(/\D/g, '');

    // Remove leading 0 if present
    if (formattedPhone.startsWith('0')) {
        formattedPhone = formattedPhone.substring(1);
    }

    // Basic heuristic for Brazil: Only add 55 if length is 10 or 11
    if (formattedPhone.length === 10 || formattedPhone.length === 11) {
        formattedPhone = '55' + formattedPhone;
    }

    // Helper to timeout promises
    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
        ]);
    };

    try {
        let registeredUser = null;

        console.log(`[WhatsApp] Validating number: ${formattedPhone}`);

        // Special handling for Brazil
        if (formattedPhone.startsWith('55')) {
            // Case A: Input has 13 digits (e.g. 55 51 9 8888 8888)
            if (formattedPhone.length === 13) {
                // Try 12 digits FIRST (remove 9)
                const phoneWithout9 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
                console.log(`[WhatsApp] Validation: Trying 12-digit version first: +${phoneWithout9}`);

                try {
                    registeredUser = await withTimeout(
                        global.whatsappClient.getNumberId(`+${phoneWithout9}`),
                        5000,
                        'Timeout checking 12-digit'
                    );
                } catch (e) { console.warn(`[WhatsApp] 12-digit lookup failed: ${e}`); }

                // If found, great! If not, try original 13 digits
                if (registeredUser) {
                    console.log(`[WhatsApp] Validation: Found on 12-digit: ${registeredUser._serialized}`);
                    return registeredUser._serialized;
                } else {
                    console.log(`[WhatsApp] Validation: 12-digit failed, trying original 13-digit: +${formattedPhone}`);
                    try {
                        registeredUser = await withTimeout(
                            global.whatsappClient.getNumberId(`+${formattedPhone}`),
                            5000,
                            'Timeout checking 13-digit'
                        );
                    } catch (e) { console.warn(`[WhatsApp] 13-digit lookup failed: ${e}`); }
                }
            }
            // Case B: Input has 12 digits (e.g. 55 51 8888 8888)
            else if (formattedPhone.length === 12) {
                // Try 12 digits FIRST (as is)
                console.log(`[WhatsApp] Validation: Trying 12-digit version first: +${formattedPhone}`);
                try {
                    registeredUser = await withTimeout(
                        global.whatsappClient.getNumberId(`+${formattedPhone}`),
                        5000,
                        'Timeout checking 12-digit'
                    );
                } catch (e) { console.warn(`[WhatsApp] 12-digit lookup failed: ${e}`); }

                // If found, great! If not, try adding 9
                if (registeredUser) {
                    console.log(`[WhatsApp] Validation: Found on 12-digit: ${registeredUser._serialized}`);
                    return registeredUser._serialized;
                } else {
                    const phoneWith9 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
                    console.log(`[WhatsApp] Validation: 12-digit failed, trying 13-digit (add 9): +${phoneWith9}`);
                    try {
                        registeredUser = await withTimeout(
                            global.whatsappClient.getNumberId(`+${phoneWith9}`),
                            5000,
                            'Timeout checking 13-digit'
                        );
                    } catch (e) { console.warn(`[WhatsApp] 13-digit lookup failed: ${e}`); }
                }
            }
            // Other lengths (e.g. landlines), just try as is
            else {
                try {
                    registeredUser = await withTimeout(
                        global.whatsappClient.getNumberId(`+${formattedPhone}`),
                        5000,
                        'Timeout checking registration'
                    );
                } catch (e) { console.warn(`[WhatsApp] Lookup failed: ${e}`); }
            }
        }
        // International numbers
        else {
            // Attempt 1: With '+'
            const lookupPhonePlus = `+${formattedPhone}`;
            try {
                registeredUser = await withTimeout(
                    global.whatsappClient.getNumberId(lookupPhonePlus),
                    5000,
                    'Timeout checking number registration (+)'
                );
            } catch (e) { console.warn(`[WhatsApp] Lookup with + failed: ${e}`); }

            // Attempt 2: Without '+'
            if (!registeredUser) {
                try {
                    registeredUser = await withTimeout(
                        global.whatsappClient.getNumberId(formattedPhone),
                        5000,
                        'Timeout checking number registration (raw)'
                    );
                } catch (e) { console.warn(`[WhatsApp] Lookup raw failed: ${e}`); }
            }
        }

        if (registeredUser) {
            console.log(`[WhatsApp] Validation: Found user: ${registeredUser._serialized}`);
            return registeredUser._serialized;
        }
    } catch (error) {
        console.error('Error validating number:', error);
    }

    console.log('[WhatsApp] Validation: No user found.');
    return null;
};

export const sendMessage = async (phone: string, message: string, mediaUrl?: string, mediaType?: string) => {
    console.log(`[WhatsApp] Attempting to send message to ${phone}`);
    messageQueue.addLog(`Tentando enviar para ${phone}...`, 'info');

    // Verificação robusta do estado do cliente
    const clientReady = await isClientReady();

    if (!clientReady) {
        const errorMsg = `Cliente WhatsApp não está pronto. Estado atual: ${global.whatsappStatus}`;
        console.error(`[WhatsApp] ${errorMsg}`);
        messageQueue.addLog(`Erro: ${errorMsg}`, 'error');

        // Tentar inicializar o cliente se ele não existir
        if (!global.whatsappClient) {
            console.log('[WhatsApp] Tentando inicializar cliente...');
            messageQueue.addLog('Tentando inicializar cliente WhatsApp...', 'info');
            getClient();

            // Aguardar um pouco e verificar novamente
            await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONFIG.RETRY_DELAY_MS));
            const retryReady = await isClientReady();

            if (!retryReady) {
                throw new Error('WhatsApp client is not ready and could not be initialized');
            }
            console.log('[WhatsApp] Cliente inicializado com sucesso após retry!');
        } else {
            throw new Error('WhatsApp client is not ready');
        }
    }

    console.log('[WhatsApp] ✅ Cliente verificado e pronto para enviar mensagem');

    // DEBUG: Log phone details
    console.log(`[WhatsApp] sendMessage received phone: "${phone}" (Length: ${phone.length})`);
    const charCodes = phone.split('').map(c => c.charCodeAt(0)).join(',');
    console.log(`[WhatsApp] Phone char codes: ${charCodes}`);

    // Helper to timeout promises
    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
        ]);
    };

    let chatId = '';

    if (phone.endsWith('@c.us')) {
        chatId = phone;
        console.log(`[WhatsApp] Using provided chatId: ${chatId}`);
        messageQueue.addLog(`Usando ID fornecido: ${chatId}`, 'info');
    } else {
        // Use the new validation function to resolve the ID
        const resolvedId = await validateWhatsAppNumber(phone);

        if (resolvedId) {
            chatId = resolvedId;
            console.log(`[WhatsApp] Number resolved to: ${chatId}`);
            messageQueue.addLog(`Número encontrado no WhatsApp: ${chatId}`, 'info');
        } else {
            console.warn('[WhatsApp] Number not found in WhatsApp registry. Using fallback strategy...');
            messageQueue.addLog(`⚠️ Número não validado. Iniciando envio forçado...`, 'info');

            // Fallback: Try to send to BOTH possibilities if validation failed
            // This is a "Force Send" strategy requested by the user

            let formattedPhone = phone.replace(/\D/g, '');
            if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
            if (formattedPhone.length === 10 || formattedPhone.length === 11) formattedPhone = '55' + formattedPhone;

            // Only applies to Brazilian numbers
            if (formattedPhone.startsWith('55')) {
                // Construct both variations
                let phone12: string; // Without 9
                let phone13: string; // With 9

                if (formattedPhone.length === 13) {
                    phone13 = formattedPhone;
                    phone12 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
                } else if (formattedPhone.length === 12) {
                    phone12 = formattedPhone;
                    phone13 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
                } else {
                    // Just use as is for other lengths
                    phone12 = formattedPhone;
                    phone13 = formattedPhone;
                }

                // Priority 1: Try 12-digit (Legacy/Standard)
                const chatId12 = `${phone12}@c.us`;
                console.log(`[WhatsApp] Force Send Attempt 1: ${chatId12}`);
                messageQueue.addLog(`Tentativa 1 (Forçada): ${chatId12}`, 'info');

                try {
                    let content: string | MessageMedia = message;
                    if (mediaUrl) {
                        try {
                            // If local path
                            if (mediaUrl.startsWith('/')) {
                                const absolutePath = path.join(process.cwd(), 'public', mediaUrl);
                                console.log(`[WhatsApp] Reading media from file: ${absolutePath}`);
                                const fileData = fs.readFileSync(absolutePath, { encoding: 'base64' });
                                const filename = path.basename(absolutePath);
                                const mime = mediaType || 'application/octet-stream'; // Fallback if not provided
                                content = new MessageMedia(mime, fileData, filename);
                                console.log(`[WhatsApp] Media created manually. Mime: ${mime}`);
                            } else {
                                content = await MessageMedia.fromUrl(mediaUrl);
                            }
                        } catch (e) {
                            console.error('Error creating media:', e);
                        }
                    }

                    const msg = await withTimeout(
                        global.whatsappClient!.sendMessage(chatId12, content, { caption: mediaUrl ? message : undefined }),
                        15000,
                        'Timeout sending message (Force 12)'
                    );
                    console.log(`[WhatsApp] Force Send 12-digit SUCCESS. ID: ${msg.id.id}`);
                    messageQueue.addLog(`✅ Envio forçado (sem 9) aceito!`, 'success');

                    // If successful, we return here!
                    // We assume if it didn't throw, it's "sent" (even if ACK is pending)

                    // Log success and update DB
                    const usedNumber = chatId12.replace('@c.us', '');
                    try {
                        await pool.query(
                            'UPDATE leads SET last_message_time = NOW(), last_message = $1 WHERE telefone = $2 OR telefone = $3',
                            [`(Enviada) ${message}`, phone, usedNumber]
                        );
                    } catch (e) {
                        console.error('[WhatsApp] Error updating DB after force send (13-digit):', e);
                    }

                    return { success: true, id: msg.id.id };

                } catch (error1) {
                    const error1Message = error1 instanceof Error ? error1.message : String(error1);
                    console.warn(`[WhatsApp] Force Send 12-digit failed: ${error1Message}`);

                    // Check if it's a LID error already
                    if (error1Message.includes('No LID for user')) {
                        const friendlyMessage = `Número ${phone} não é WhatsApp`;
                        console.error(`[WhatsApp] ❌ ${friendlyMessage}`);
                        messageQueue.addLog(`❌ ${friendlyMessage}`, 'error');
                        throw new Error(friendlyMessage);
                    }

                    messageQueue.addLog(`❌ Falha na tentativa 1: ${error1Message}`, 'error');

                    // Priority 2: Try 13-digit (New/9th digit)
                    const chatId13 = `${phone13}@c.us`;
                    console.log(`[WhatsApp] Force Send Attempt 2: ${chatId13}`);
                    messageQueue.addLog(`Tentativa 2 (Forçada): ${chatId13}`, 'info');

                    try {
                        let content: string | MessageMedia = message;
                        if (mediaUrl) {
                            try {
                                if (mediaUrl.startsWith('/')) {
                                    const absolutePath = path.join(process.cwd(), 'public', mediaUrl);
                                    console.log(`[WhatsApp] Reading media from file: ${absolutePath}`);
                                    const fileData = fs.readFileSync(absolutePath, { encoding: 'base64' });
                                    const filename = path.basename(absolutePath);
                                    const mime = mediaType || 'application/octet-stream';
                                    content = new MessageMedia(mime, fileData, filename);
                                    console.log(`[WhatsApp] Media created manually. Mime: ${mime}`);
                                } else {
                                    content = await MessageMedia.fromUrl(mediaUrl);
                                }
                            } catch (e) {
                                console.error('Error creating media:', e);
                            }
                        }

                        const msg = await withTimeout(
                            global.whatsappClient!.sendMessage(chatId13, content, { caption: mediaUrl ? message : undefined }),
                            15000,
                            'Timeout sending message (Force 13)'
                        );
                        console.log(`[WhatsApp] Force Send 13-digit SUCCESS. ID: ${msg.id.id}`);
                        messageQueue.addLog(`✅ Envio forçado (com 9) aceito!`, 'success');

                        const usedNumber = chatId13.replace('@c.us', '');
                        try {
                            await pool.query(
                                'UPDATE leads SET last_message_time = NOW(), last_message = $1 WHERE telefone = $2 OR telefone = $3',
                                [`(Enviada) ${message}`, phone, usedNumber]
                            );
                        } catch (e) {
                            console.error('[WhatsApp] Error updating DB after force send (12-digit):', e);
                        }

                        return { success: true, id: msg.id.id };

                    } catch (error2) {
                        const error2Message = error2 instanceof Error ? error2.message : String(error2);
                        console.error(`[WhatsApp] Force Send 13-digit failed: ${error2Message}`);

                        // Check if it's a LID error
                        if (error2Message.includes('No LID for user')) {
                            const friendlyMessage = `Número ${phone} não é WhatsApp`;
                            console.error(`[WhatsApp] ❌ ${friendlyMessage}`);
                            messageQueue.addLog(`❌ ${friendlyMessage}`, 'error');
                            throw new Error(friendlyMessage);
                        }

                        messageQueue.addLog(`❌ Falha na tentativa 2: ${error2Message}`, 'error');
                        throw error2;
                    }
                }
            } else {
                // International fallback
                chatId = `${formattedPhone}@c.us`;
            }
        }
    }

    try {
        console.log(`[WhatsApp] Sending message to chatId: ${chatId}`);

        let content: string | MessageMedia = message;
        if (mediaUrl) {
            try {
                if (mediaUrl.startsWith('/')) {
                    const absolutePath = path.join(process.cwd(), 'public', mediaUrl);
                    console.log(`[WhatsApp] Reading media from file: ${absolutePath}`);
                    const fileData = fs.readFileSync(absolutePath, { encoding: 'base64' });
                    const filename = path.basename(absolutePath);
                    const mime = mediaType || 'application/octet-stream';
                    content = new MessageMedia(mime, fileData, filename);
                    console.log(`[WhatsApp] Media created manually. Mime: ${mime}`);
                } else {
                    console.log(`[WhatsApp] Creating media from URL: ${mediaUrl}`);
                    content = await MessageMedia.fromUrl(mediaUrl);
                    console.log(`[WhatsApp] Media created from URL. Mime: ${content.mimetype}`);
                }
            } catch (e) {
                console.error('[WhatsApp] Error creating media:', e);
            }
        }

        // Verificar se o cliente está realmente disponível antes de enviar
        if (!global.whatsappClient) {
            const errorMsg = 'WhatsApp client is null - initialization may have failed';
            console.error(`[WhatsApp] ${errorMsg}`);
            messageQueue.addLog(`❌ ${errorMsg}`, 'error');
            throw new Error(errorMsg);
        }

        // Send message with timeout (15s)
        const msg = await withTimeout(
            global.whatsappClient.sendMessage(chatId, content, { caption: mediaUrl ? message : undefined }),
            15000,
            'Timeout sending message'
        );

        console.log(`[WhatsApp] Message sent successfully. ID: ${msg.id.id} | ACK: ${msg.ack} | To: ${msg.to}`);
        messageQueue.addLog(`Mensagem enviada! ID: ${msg.id.id} (ACK: ${msg.ack})`, 'success');

        // Log exactly the number used
        const usedNumber = chatId.replace('@c.us', '');
        messageQueue.addLog(`Mensagem enviada para ${usedNumber}`, 'success');

        // Update last_message_time in DB
        try {
            const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
            await pool.query(
                'UPDATE leads SET last_message_time = NOW(), last_message = $1 WHERE telefone = $2 OR telefone = $3',
                [`(Enviada) ${message}`, phone, phoneWithoutCountry]
            );
        } catch (dbError) {
            console.error('[WhatsApp] Error updating last_message_time:', dbError);
        }

        return { success: true, id: msg.id.id };
    } catch (error: unknown) {
        console.error('[WhatsApp] Error sending message:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        // LID errors are NOT critical - they just mean the number is invalid
        // These should NOT trigger a restart
        if (errorMessage.includes('No LID for user')) {
            const friendlyMessage = `Número ${phone} não é WhatsApp`;
            console.error(`[WhatsApp] ❌ ${friendlyMessage}`);
            console.error(`[WhatsApp] Original phone: ${phone}`);
            console.error(`[WhatsApp] Tried chatId: ${chatId}`);
            messageQueue.addLog(`❌ ${friendlyMessage}`, 'error');
            throw new Error(friendlyMessage);
        }

        // Check for critical errors that require client restart
        if (errorMessage.includes('Session closed') ||
            errorMessage.includes('Protocol error') ||
            errorMessage.includes('Target closed') ||
            errorMessage.includes('browser has disconnected') ||
            errorMessage.includes('Evaluation failed') ||
            errorMessage.includes('Timeout')) {

            console.error('[WhatsApp] Erro crítico ou timeout detectado durante envio de mensagem.');
            messageQueue.addLog(`Erro crítico ou timeout (${errorMessage}). Verificando se pode reiniciar...`, 'error');
            addSystemAlert('Erro Crítico WhatsApp', `Erro detectado: ${errorMessage}. Tentando reiniciar...`, 'error');

            // Check if we can restart (not in a restart loop)
            if (canRestart()) {
                console.log('[WhatsApp] Dentro dos limites de restart. Reiniciando WhatsApp...');
                messageQueue.addLog('🔄 Reiniciando WhatsApp devido a erro crítico...', 'info');

                // Wait before restart to allow things to settle
                await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONFIG.RESTART_COOLDOWN_MS));

                // Trigger restart asynchronously so we don't block
                restartClient().catch(console.error);

                throw new Error('CRITICAL_SESSION_ERROR');
            } else {
                console.error('[WhatsApp] ❌ Muitos restarts consecutivos. NÃO reiniciando para evitar loop.');
                messageQueue.addLog('❌ Muitos restarts. Intervenção manual necessária.', 'error');
                throw new Error('TOO_MANY_RESTARTS');
            }
        }

        messageQueue.addLog(`Erro ao enviar para ${phone}: ${errorMessage}`, 'error');
        throw error;
    }
};

export const logout = async () => {
    console.log('[WhatsApp] Logging out...');
    messageQueue.addLog('Desconectando WhatsApp...', 'info');

    if (global.whatsappClient) {
        try {
            await global.whatsappClient.logout();
            messageQueue.addLog('Logout executado com sucesso.', 'success');
        } catch (e) {
            console.error('Error logging out:', e);
            messageQueue.addLog('Erro ao executar logout.', 'error');
        }
        try {
            await global.whatsappClient.destroy();
            messageQueue.addLog('Cliente destruído com sucesso.', 'success');
        } catch (e) {
            console.error('Error destroying client:', e);
            messageQueue.addLog('Erro ao destruir cliente.', 'error');
        }
        global.whatsappClient = null;
        global.whatsappStatus = 'disconnected';
        global.whatsappQrCode = null;
        messageQueue.addLog('WhatsApp desconectado.', 'success');
    }
};

export const resetSession = async (autoReconnect: boolean = false) => {
    console.log('[WhatsApp] Resetting session...');
    messageQueue.addLog('Resetando sessão e apagando dados de autenticação...', 'info');

    // Force destroy first
    if (global.whatsappClient) {
        try {
            await global.whatsappClient.destroy();
        } catch (e) {
            console.error('Error destroying client:', e);
        }
        global.whatsappClient = null;
        global.whatsappStatus = 'disconnected';
        global.whatsappQrCode = null;
    }

    // Wait a bit to ensure file locks are released
    await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONFIG.RETRY_DELAY_MS));

    // Delete auth folder
    const fs = await import('fs/promises');
    const path = await import('path');
    const authPath = path.resolve('./.wwebjs_auth');

    try {
        await fs.rm(authPath, { recursive: true, force: true });
        console.log('[WhatsApp] Auth folder deleted');
        messageQueue.addLog('Dados de autenticação apagados.', 'success');
    } catch (e) {
        console.error('[WhatsApp] Error deleting auth folder:', e);
        messageQueue.addLog('Erro ao apagar dados de autenticação (pode estar em uso).', 'error');
    }

    // Re-initialize automatically only if requested
    if (autoReconnect) {
        console.log('[WhatsApp] Session reset complete. Re-initializing...');
        messageQueue.addLog('Sessão resetada. Reiniciando cliente...', 'info');
        getClient();
    } else {
        console.log('[WhatsApp] Session reset complete.');
        messageQueue.addLog('Sessão resetada com sucesso.', 'success');
    }
};

export const handleMessageCreate = async (msg: WhatsAppMessage) => {
    console.log('🔔 EVENT message_create DISPARADO!');

    // Only process direct messages (not groups)
    if (!msg.from.endsWith('@c.us') && !msg.to?.endsWith('@c.us')) {
        return;
    }

    // Determine phone number and direction
    let phone: string;
    let direction: 'incoming' | 'outgoing';

    if (msg.fromMe) {
        // Outgoing message - get recipient's phone
        phone = msg.to?.replace('@c.us', '') || '';
        direction = 'outgoing';
    } else {
        // Incoming message - get sender's phone  
        phone = msg.from.replace('@c.us', '');
        direction = 'incoming';
    }

    if (!phone) return;

    // --- AI-POWERED AUTO REPLY INTEGRATION ---
    if (direction === 'incoming' && msg.body && msg.body.trim()) {
        try {
            // Import auto-reply service dynamically to avoid circular dependencies
            const { autoReplyService } = await import('../services/autoReplyService');

            console.log(`🤖 Processing auto-reply for message from ${phone}: "${msg.body}"`);

            // Process the message and get the response if applicable
            const response = await autoReplyService.processIncomingMessage(phone, msg.body);

            // If we got a response, send it
            if (response && typeof response === 'string') {
                console.log(`🤖 Sending auto-reply to ${phone}: "${response}"`);

                // Add a small delay to seem more human
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Send the auto-reply
                if (msg.reply) {
                    await msg.reply(response);
                    messageQueue.addLog(`🤖 Auto-resposta enviada para ${phone}`, 'success');
                    console.log(`✅ Auto-reply sent successfully to ${phone}`);
                } else {
                    // Fallback: send as new message
                    await sendMessage(phone, response);
                    messageQueue.addLog(`🤖 Auto-resposta enviada para ${phone} (fallback)`, 'success');
                    console.log(`✅ Auto-reply sent successfully to ${phone} (via fallback)`);
                }
            } else {
                console.log(`ℹ️ No auto-reply triggered for message from ${phone}`);
            }
        } catch (error) {
            console.error('[WhatsApp] Error processing auto-reply:', error);
            // Don't throw - continue processing the message normally
        }
    }
    // ------------------------


    console.log('='.repeat(60));
    console.log(`📱 MENSAGEM ${direction.toUpperCase()} ${direction === 'outgoing' ? 'para' : 'de'} ${phone}`);
    console.log(`📝 Conteúdo: ${msg.body}`);
    messageQueue.addLog(`📱 ${direction === 'outgoing' ? 'Enviada para' : 'Recebida de'} ${phone}: ${msg.body}`, 'info');

    try {
        // Check if this phone is a registered contact
        // Use centralized phone utility for consistent variation generation
        const { getPhoneVariations } = await import('./utils/phoneUtils');
        const variations = getPhoneVariations(phone);

        console.log(`🔍 Buscando no banco por variações: ${variations.join(', ')}`);

        // Create placeholders for PostgreSQL ($1, $2, etc)
        const placeholders = variations.map((_, i) => `$${i + 1}`).join(',');
        const result = await pool.query(`
            SELECT cpf, nome, telefone FROM leads 
            WHERE telefone IN (${placeholders})
            ORDER BY CASE WHEN cpf != telefone THEN 0 ELSE 1 END, cpf
            LIMIT 1
        `, variations);
        let contact = result.rows[0] as any;

        // Fallback: Try matching by last 8 digits
        if (!contact && phone.length >= 8) {
            const last8 = phone.slice(-8);
            console.log(`⚠️ Contato não encontrado por variações exatas. Tentando fallback pelos últimos 8 dígitos: ${last8}`);

            const fallbackResult = await pool.query(
                'SELECT cpf, nome, telefone FROM leads WHERE telefone LIKE $1',
                [`%${last8}`]
            );
            const potentialMatch = fallbackResult.rows[0];

            if (potentialMatch) {
                console.log(`✅ Contato encontrado via fallback (últimos 8 dígitos): ${potentialMatch.nome}`);
                contact = potentialMatch;
            }
        }

        if (contact) {
            console.log(`✅ Contato cadastrado: ${contact.nome} (CPF: ${contact.cpf}, Tel: ${contact.telefone})`);
            messageQueue.addLog(`✅ ${contact.nome}: ${msg.body}`, 'success');

            // Store message in database with correct direction and WhatsApp timestamp
            // msg.timestamp is Unix timestamp (seconds), convert to ISO string
            const messageTime = new Date(msg.timestamp * 1000).toISOString();

            let mediaUrl = null;
            let mediaType = null;

            if (msg.hasMedia && msg.downloadMedia) {
                try {
                    const media = await msg.downloadMedia();
                    if (media) {
                        const extension = media.mimetype.split('/')[1].split(';')[0];
                        const filename = `${uuidv4()}.${extension}`;
                        const uploadDir = path.join(process.cwd(), 'public', 'uploads');

                        if (!fs.existsSync(uploadDir)) {
                            fs.mkdirSync(uploadDir, { recursive: true });
                        }

                        const filepath = path.join(uploadDir, filename);
                        fs.writeFileSync(filepath, media.data, 'base64');

                        mediaUrl = `/uploads/${filename}`;
                        mediaType = media.mimetype.startsWith('image') ? 'image' :
                            media.mimetype.startsWith('audio') ? 'audio' :
                                media.mimetype.startsWith('video') ? 'video' : 'document';

                        console.log(`[WhatsApp] Media saved: ${mediaUrl} (${mediaType})`);
                    }
                } catch (mediaError) {
                    console.error('[WhatsApp] Error downloading media:', mediaError);
                }
            }

            const insertResult = await pool.query(`
                INSERT INTO messages (contact_phone, id, content, from_me, timestamp, type)
                VALUES ($1, $2, $3, $4, $5, 'text')
                ON CONFLICT (id) DO NOTHING
                RETURNING id
            `, [contact.cpf, msg.id.id, msg.body, direction === 'outgoing', messageTime]);

            const insertedId = insertResult.rows[0]?.id || 0;
            console.log(`💾 Mensagem ${direction} salva no banco! ID: ${insertedId}`);
            messageQueue.addLog(`💾 Mensagem salva! ID: ${insertedId}`, 'success');

            // Emit Socket.io event for real-time update (ONLY for incoming messages)
            // Don't emit for outgoing messages to avoid notification spam
            if (direction === 'incoming') {
                try {
                    // Extract phone number from WhatsApp message
                    const whatsappPhone = msg.from.replace('@c.us', '');

                    // Emit to CPF room (for existing chat page)
                    const emittedToCpf = emitNewMessage({
                        contactCpf: contact.cpf,
                        contactName: contact.nome || contact.telefone,
                        message: {
                            id: insertedId,
                            message_id: msg.id.id,
                            direction,
                            body: msg.body,
                            media_url: mediaUrl,
                            media_type: mediaType as any,
                            timestamp: messageTime,
                            status: 'sent'
                        }
                    });

                    // ALSO emit to phone room (for WhatsApp POC) - using different prefix to avoid collision
                    const emittedToPhone = emitNewMessageToPhone(whatsappPhone, {
                        contactName: contact.nome || contact.telefone,
                        message: {
                            id: insertedId,
                            message_id: msg.id.id,
                            direction,
                            body: msg.body,
                            media_url: mediaUrl,
                            media_type: mediaType as any,
                            timestamp: messageTime,
                            status: 'sent'
                        }
                    });

                    if (emittedToCpf || emittedToPhone) {
                        console.log(`[Socket] ✅ Event emitted for INCOMING message from CPF:${contact.cpf} Phone:${whatsappPhone}`);
                    } else {
                        console.error(`[Socket] ❌ FAILED to emit - Socket.io not ready!`);
                    }
                } catch (socketError) {
                    // Don't fail if Socket.io is not available
                    console.warn('[Socket] Could not emit message event:', socketError);
                }
            } else {
                console.log(`[Socket] ⏭️ Skipping emit for OUTGOING message (no notification needed)`);
            }

            // Update lead's last message (ALWAYS update, regardless of direction)
            console.log(`[WhatsApp] 🔄 Tentando atualizar last_message para CPF: ${contact.cpf}`);
            console.log(`[WhatsApp] 📝 Mensagem: "${msg.body?.substring(0, 50)}"`);
            console.log(`[WhatsApp] ⏰ Timestamp: ${messageTime}`);
            console.log(`[WhatsApp] ➡️ Direction: ${direction}`);

            try {
                const updateResult = await pool.query(`
                    UPDATE leads 
                    SET last_message = $1,
                        last_message_time = $2
                    WHERE cpf = $3
                `, [msg.body || (mediaType ? `[${mediaType}]` : 'Mensagem'), messageTime, contact.cpf]);

                console.log(`✅ Lead ${contact.cpf} UPDATE executado! Changes: ${updateResult.rowCount}`);

                if (updateResult.rowCount === 0) {
                    console.warn(`⚠️ UPDATE não afetou nenhuma linha! CPF ${contact.cpf} pode não existir na tabela leads`);
                }
            } catch (updateError) {
                console.error('[WhatsApp] ❌ Error updating lead last_message:', updateError);
            }

            if (direction === 'incoming') {
                await pool.query(`
                    UPDATE leads
                    SET unread_count = COALESCE(unread_count, 0) + 1
                    WHERE cpf = $1
                `, [contact.cpf]);

                // Emit contact update event
                try {
                    emitContactUpdated({
                        cpf: contact.cpf,
                        updates: {
                            last_message: msg.body || (mediaType ? `[${mediaType}]` : 'Mensagem'),
                            last_message_time: messageTime,
                            last_message_direction: 'incoming',
                            unread_count: -1 // Signal to increment on client side
                        }
                    });
                } catch (socketError) {
                    console.warn('[Socket] Could not emit contact update:', socketError);
                }

                // Log activity: WhatsApp received
                try {
                    activityService.logWhatsAppReceived(contact.cpf, msg.body || `[${mediaType || 'mídia'}]`);
                } catch (activityError) {
                    console.error('[WhatsApp] Error logging activity:', activityError);
                }
            }

            getContactProfilePicture(contact.telefone).then(async (profilePicUrl) => {
                if (profilePicUrl) {
                    try {
                        await pool.query(
                            'UPDATE leads SET profile_image = $1 WHERE cpf = $2',
                            [profilePicUrl, contact.cpf]
                        );
                        console.log(`[WhatsApp] ✓ Profile picture updated for ${contact.nome}`);
                    } catch (err) {
                        console.error('[WhatsApp] Error updating profile picture:', err);
                    }
                }
            }).catch(err => {
                console.error('[WhatsApp] Error fetching profile picture:', err);
            });

        } else {
            console.log(`⚠️ Contato não encontrado. Criando novo lead para: ${phone}`);

            // Get contact info correctly using getContact()
            // This works for both incoming and outgoing messages to get the OTHER party
            let contactName = phone;
            try {
                const chatContact = await msg.getContact();
                contactName = chatContact.pushname || chatContact.name || chatContact.number || phone;
            } catch (e) {
                console.error('Error fetching contact info:', e);
                // Fallback to notifyName if available (mostly for incoming)
                contactName = (msg as any)._data?.notifyName || phone;
            }

            const tempCpf = phone; // Use phone as temporary CPF

            try {
                await pool.query(`
                    INSERT INTO leads (cpf, nome, telefone, status, created_at)
                    VALUES ($1, $2, $3, 'LEAD', NOW())
                `, [tempCpf, contactName, phone]);

                // Now we have the contact, proceed to save message
                contact = { cpf: tempCpf, nome: contactName, telefone: phone };
                messageQueue.addLog(`✨ Novo lead criado: ${contactName}`, 'success');

                // Save the message (duplicated logic from above, could be refactored but keeping inline for safety)
                const messageTime = new Date(msg.timestamp * 1000).toISOString();

                let mediaUrl = null;
                let mediaType = null;

                if (msg.hasMedia && msg.downloadMedia) {
                    try {
                        const media = await msg.downloadMedia();
                        if (media) {
                            const extension = media.mimetype.split('/')[1].split(';')[0];
                            const filename = `${uuidv4()}.${extension}`;
                            const uploadDir = path.join(process.cwd(), 'public', 'uploads');

                            if (!fs.existsSync(uploadDir)) {
                                fs.mkdirSync(uploadDir, { recursive: true });
                            }

                            const filepath = path.join(uploadDir, filename);
                            fs.writeFileSync(filepath, media.data, 'base64');

                            mediaUrl = `/uploads/${filename}`;
                            mediaType = media.mimetype.startsWith('image') ? 'image' :
                                media.mimetype.startsWith('audio') ? 'audio' :
                                    media.mimetype.startsWith('video') ? 'video' : 'document';
                        }
                    } catch (mediaError) {
                        console.error('[WhatsApp] Error downloading media for new lead:', mediaError);
                    }
                }

                const insertMsgResult = await pool.query(`
                    INSERT INTO messages (contact_phone, id, content, from_me, timestamp, type)
                    VALUES ($1, $2, $3, $4, $5, 'text')
                    ON CONFLICT (id) DO NOTHING
                    RETURNING id
                `, [contact.cpf, msg.id.id, msg.body, direction === 'outgoing', messageTime]);
                const msgId = insertMsgResult.rows[0]?.id || 0;
                console.log(`💾 Mensagem ${direction} salva para novo lead! ID: ${msgId}`);

                // Update lead's last message
                if (direction === 'incoming') {
                    await pool.query(`
                        UPDATE leads
                        SET last_message = $1, 
                            last_message_time = $2,
                            unread_count = 1
                        WHERE cpf = $3
                    `, [msg.body || (mediaType ? `[${mediaType}]` : 'Mensagem'), messageTime, contact.cpf]);
                }

                getContactProfilePicture(contact.telefone).then(async (profilePicUrl) => {
                    if (profilePicUrl) {
                        try {
                            await pool.query('UPDATE leads SET profile_image = $1 WHERE cpf = $2', [profilePicUrl, contact.cpf]);
                        } catch (err) {
                            console.error('[WhatsApp] Error updating profile picture:', err);
                        }
                    }
                });

            } catch (err) {
                console.error('Erro ao criar novo lead:', err);
                messageQueue.addLog(`❌ Erro ao criar lead: ${err}`, 'error');
            }
        }

    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        messageQueue.addLog(`❌ Erro: ${error}`, 'error');
    }

    console.log('='.repeat(60));
};

/**
 * Verifica se um número está em um grupo específico do WhatsApp
 * @param phone - Número de telefone (pode incluir ou não o código do país)
 * @param groupId - ID do grupo no formato '123456789-987654321@g.us' ou nome do grupo
 * @returns Promise<boolean> - true se o número estiver no grupo, false caso contrário
 */
export const isNumberInGroup = async (phone: string, groupId: string): Promise<boolean> => {
    console.log(`[WhatsApp] Verificando se ${phone} está no grupo ${groupId}`);

    // Validação simples e direta do cliente
    if (!global.whatsappClient) {
        const errorMsg = `WhatsApp client is not initialized. Status: ${global.whatsappStatus}`;
        console.error(`[WhatsApp] ${errorMsg}`);
        throw new Error('WhatsApp client is not ready');
    }

    if (global.whatsappStatus !== 'ready') {
        const errorMsg = `WhatsApp is not in ready state. Current status: ${global.whatsappStatus}`;
        console.error(`[WhatsApp] ${errorMsg}`);
        throw new Error('WhatsApp client is not ready');
    }

    try {
        // Normalizar o número de telefone
        let formattedPhone = phone.replace(/\D/g, '');

        // Remover zero inicial se presente
        if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
        }

        // Adicionar código do país se for número brasileiro
        if (formattedPhone.length === 10 || formattedPhone.length === 11) {
            formattedPhone = '55' + formattedPhone;
        }

        // Verificação adicional imediatamente antes de usar o cliente
        if (!global.whatsappClient) {
            throw new Error('WhatsApp client became undefined before executing getChats');
        }

        // Obter todos os grupos
        console.log('[WhatsApp] Obtendo lista de chats...');
        const chats = await global.whatsappClient.getChats();
        const groups = chats.filter(chat => chat.isGroup);

        console.log(`[WhatsApp] Total de grupos encontrados: ${groups.length}`);

        // Encontrar o grupo específico
        let targetGroup = null;

        // Se groupId termina com @g.us, é um ID de grupo direto
        if (groupId.endsWith('@g.us')) {
            targetGroup = groups.find(g => g.id._serialized === groupId);
        } else {
            // Caso contrário, procurar pelo nome do grupo
            targetGroup = groups.find(g => g.name.toLowerCase().includes(groupId.toLowerCase()));
        }

        if (!targetGroup) {
            console.warn(`[WhatsApp] Grupo não encontrado: ${groupId}`);
            throw new Error(`Group not found: ${groupId}`);
        }

        console.log(`[WhatsApp] Grupo encontrado: ${targetGroup.name} (${targetGroup.id._serialized})`);

        // Obter participantes do grupo
        const chat = await global.whatsappClient.getChatById(targetGroup.id._serialized) as GroupChat;
        const participants = chat.participants || [];

        console.log(`[WhatsApp] Total de participantes no grupo: ${participants.length}`);

        // Criar variações do número para verificar
        const variations: string[] = [formattedPhone];

        // Para números brasileiros, tentar com e sem o 9º dígito
        if (formattedPhone.startsWith('55') && formattedPhone.length === 13) {
            // Tem 9º dígito, tentar sem ele
            const without9 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
            variations.push(without9);
        } else if (formattedPhone.startsWith('55') && formattedPhone.length === 12) {
            // Não tem 9º dígito, tentar com ele
            const with9 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
            variations.push(with9);
        }

        console.log(`[WhatsApp] Verificando variações: ${variations.join(', ')}`);

        // Verificar se alguma variação está nos participantes
        for (const variation of variations) {
            const isInGroup = participants.some((p: { id: { user: string } }) => {
                const participantNumber = p.id.user;
                return participantNumber === variation;
            });

            if (isInGroup) {
                console.log(`[WhatsApp] ✓ Número ${phone} encontrado no grupo ${targetGroup.name} (variação: ${variation})`);
                return true;
            }
        }

        console.log(`[WhatsApp] ✗ Número ${phone} NÃO está no grupo ${targetGroup.name}`);
        return false;

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorString = String(error);

        // Detectar erros específicos do Puppeteer/WhatsApp Client
        if (errorString.includes('Cannot read properties of undefined') ||
            errorString.includes('pptr://') ||
            errorString.includes('evaluation_script')) {
            console.error('[WhatsApp] Cliente WhatsApp foi destruído ou está em estado inválido');
            throw new Error('WhatsApp client is not ready');
        }

        console.error(`[WhatsApp] Erro ao verificar número no grupo: ${errorMessage}`);
        throw error;
    }
};

/**
 * Lista todos os grupos disponíveis
 * @returns Promise<Array<{id: string, name: string, participantCount: number}>>
 */
export const listAllGroups = async (): Promise<Array<{ id: string; name: string; participantCount: number }>> => {
    console.log('[WhatsApp] Listando todos os grupos');

    // Validação simples e direta do cliente
    if (!global.whatsappClient) {
        const errorMsg = `WhatsApp client is not initialized. Status: ${global.whatsappStatus}`;
        console.error(`[WhatsApp] ${errorMsg}`);
        throw new Error('WhatsApp client is not ready');
    }

    if (global.whatsappStatus !== 'ready') {
        const errorMsg = `WhatsApp is not in ready state. Current status: ${global.whatsappStatus}`;
        console.error(`[WhatsApp] ${errorMsg}`);
        throw new Error('WhatsApp client is not ready');
    }

    try {
        // Verificação adicional imediatamente antes de usar o cliente
        if (!global.whatsappClient) {
            throw new Error('WhatsApp client became undefined before executing getChats');
        }

        const chats = await global.whatsappClient.getChats();
        const groups = chats.filter(chat => chat.isGroup);

        const groupList = groups.map(group => ({
            id: group.id._serialized,
            name: group.name,
            participantCount: (group as any).participants?.length || 0
        }));

        console.log(`[WhatsApp] Total de grupos: ${groupList.length}`);
        return groupList;

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorString = String(error);

        // Detectar erros específicos do Puppeteer/WhatsApp Client
        if (errorString.includes('Cannot read properties of undefined') ||
            errorString.includes('pptr://') ||
            errorString.includes('evaluation_script')) {
            console.error('[WhatsApp] Cliente WhatsApp foi destruído ou está em estado inválido');
            throw new Error('WhatsApp client is not ready');
        }

        console.error(`[WhatsApp] Erro ao listar grupos: ${errorMessage}`);
        throw error;
    }
};

/**
 * Obtém todos os participantes de um grupo específico
 * @param groupId - ID do grupo no formato '123456789-987654321@g.us' ou nome do grupo
 * @returns Promise<Array<{phone: string, isAdmin: boolean}>>
 */
export const getGroupParticipants = async (
    groupId: string
): Promise<Array<{ phone: string; isAdmin: boolean; name?: string }>> => {
    console.log(`[WhatsApp] Obtendo participantes do grupo ${groupId}`);

    // Validação simples e direta do cliente
    if (!global.whatsappClient) {
        const errorMsg = `WhatsApp client is not initialized. Status: ${global.whatsappStatus}`;
        console.error(`[WhatsApp] ${errorMsg}`);
        throw new Error('WhatsApp client is not ready');
    }

    if (global.whatsappStatus !== 'ready') {
        const errorMsg = `WhatsApp is not in ready state. Current status: ${global.whatsappStatus}`;
        console.error(`[WhatsApp] ${errorMsg}`);
        throw new Error('WhatsApp client is not ready');
    }

    try {
        // Verificação adicional imediatamente antes de usar o cliente
        if (!global.whatsappClient) {
            throw new Error('WhatsApp client became undefined before executing getChats');
        }

        const chats = await global.whatsappClient.getChats();
        const groups = chats.filter(chat => chat.isGroup);

        // Encontrar o grupo
        let targetGroup = null;
        if (groupId.endsWith('@g.us')) {
            targetGroup = groups.find(g => g.id._serialized === groupId);
        } else {
            targetGroup = groups.find(g => g.name.toLowerCase().includes(groupId.toLowerCase()));
        }

        if (!targetGroup) {
            console.warn(`[WhatsApp] Grupo não encontrado: ${groupId}`);
            throw new Error(`Group not found: ${groupId}`);
        }

        const chat = await global.whatsappClient.getChatById(targetGroup.id._serialized) as GroupChat;
        const participants = chat.participants || [];

        const participantList = participants.map((p: { id: { user: string }; isAdmin?: boolean }) => ({
            phone: p.id.user,
            isAdmin: p.isAdmin || false,
            name: p.id.user // A biblioteca não fornece o nome diretamente
        }));

        console.log(`[WhatsApp] Total de participantes no grupo ${targetGroup.name}: ${participantList.length}`);
        return participantList;

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorString = String(error);

        // Detectar erros específicos do Puppeteer/WhatsApp Client
        if (errorString.includes('Cannot read properties of undefined') ||
            errorString.includes('pptr://') ||
            errorString.includes('evaluation_script')) {
            console.error('[WhatsApp] Cliente WhatsApp foi destruído ou está em estado inválido');
            throw new Error('WhatsApp client is not ready');
        }

        console.error(`[WhatsApp] Erro ao obter participantes do grupo: ${errorMessage}`);
        throw error;
    }
};

// ============================================================================
// AUTO-INITIALIZATION
// ============================================================================

/**
 * AUTO-INITIALIZATION DISABLED
 * 
 * We do NOT want to initialize the client automatically when the module loads,
 * because this module is imported during the Next.js build process (static generation).
 * If we initialize here, it tries to launch Chrome/Puppeteer during 'next build',
 * causing the build to fail.
 * 
 * Instead, we initialize the client explicitly in server.ts when the server starts.
 */

