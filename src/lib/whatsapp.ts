import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import db from './db';
import { messageQueue } from './messageQueue';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define a global type to prevent TypeScript errors
declare global {
    var whatsappClient: Client | null;
    var whatsappQrCode: string | null;
    var whatsappStatus: 'disconnected' | 'initializing' | 'ready';
}

// Initialize globals if they don't exist
if (!global.whatsappStatus) {
    global.whatsappStatus = 'disconnected';
    global.whatsappQrCode = null;
    global.whatsappClient = null;
}

const addSystemAlert = (title: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    try {
        const stmt = db.prepare('INSERT INTO system_notifications (title, message, type) VALUES (?, ?, ?)');
        stmt.run(title, message, type);
    } catch (e) {
        console.error('Error adding system alert:', e);
    }
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

        global.whatsappClient = new Client({
            authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
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
            console.log('🟢🟢🟢 CLIENT IS READY! WHATSAPP CONNECTED! 🟢🟢🟢');
            messageQueue.addLog('WhatsApp Conectado e Pronto!', 'success');
            addSystemAlert('WhatsApp Conectado', 'A conexão com o WhatsApp foi estabelecida com sucesso.', 'success');

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
        });

        global.whatsappClient.on('disconnected', () => {
            global.whatsappStatus = 'disconnected';
            global.whatsappQrCode = null;
            console.log('Client was logged out');
            messageQueue.addLog('Cliente desconectado.', 'error');
            addSystemAlert('WhatsApp Desconectado', 'O cliente WhatsApp foi desconectado.', 'error');
            global.whatsappClient = null;
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
            // ACK_SERVER = 1 (Sent)
            // ACK_DEVICE = 2 (Delivered)
            // ACK_READ = 3 (Read)
            // ACK_PLAYED = 4 (Played - audio)

            if (ack === 1) status = 'sent';
            else if (ack === 2) status = 'delivered';
            else if (ack >= 3) status = 'read';
            else if (ack === -1) status = 'failed';

            try {
                const stmt = db.prepare('UPDATE messages SET status = ? WHERE message_id = ?');
                const result = stmt.run(status, msg.id.id);

                if (result.changes > 0) {
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
    return {
        status: global.whatsappStatus || 'disconnected',
        qrCode: global.whatsappQrCode
    };
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
    } catch (error: any) {
        console.log(`[WhatsApp] Could not get profile picture for ${phone}: ${error.message}`);
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

    if (!global.whatsappClient || global.whatsappStatus !== 'ready') {
        console.error('[WhatsApp] Client not ready');
        messageQueue.addLog('Erro: Cliente WhatsApp não está pronto.', 'error');
        throw new Error('WhatsApp client is not ready');
    }

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
                        global.whatsappClient.sendMessage(chatId12, content, { caption: mediaUrl ? message : undefined }),
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
                        const stmt = db.prepare(`
                            UPDATE leads SET last_message_time = CURRENT_TIMESTAMP, last_message = ? WHERE telefone = ? OR telefone = ?
                        `);
                        stmt.run(`(Enviada) ${message}`, phone, usedNumber);
                    } catch (e) { }

                    return { success: true, id: msg.id.id };

                } catch (error1) {
                    console.warn(`[WhatsApp] Force Send 12-digit failed: ${error1}`);
                    messageQueue.addLog(`❌ Falha na tentativa 1: ${error1}`, 'error');

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
                            global.whatsappClient.sendMessage(chatId13, content, { caption: mediaUrl ? message : undefined }),
                            15000,
                            'Timeout sending message (Force 13)'
                        );
                        console.log(`[WhatsApp] Force Send 13-digit SUCCESS. ID: ${msg.id.id}`);
                        messageQueue.addLog(`✅ Envio forçado (com 9) aceito!`, 'success');

                        // Log success and update DB
                        const usedNumber = chatId13.replace('@c.us', '');
                        try {
                            const stmt = db.prepare(`
                                UPDATE leads SET last_message_time = CURRENT_TIMESTAMP, last_message = ? WHERE telefone = ? OR telefone = ?
                            `);
                            stmt.run(`(Enviada) ${message}`, phone, usedNumber);
                        } catch (e) { }

                        return { success: true, id: msg.id.id };

                    } catch (error2) {
                        console.error(`[WhatsApp] Force Send 13-digit failed: ${error2}`);
                        messageQueue.addLog(`❌ Falha na tentativa 2: ${error2}`, 'error');
                        throw error2; // Throw the last error
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
            const stmt = db.prepare(`
                UPDATE leads 
                SET last_message_time = CURRENT_TIMESTAMP, 
                    last_message = ? 
                WHERE telefone = ? OR telefone = ?
            `);
            const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
            stmt.run(`(Enviada) ${message}`, phone, phoneWithoutCountry);
        } catch (dbError) {
            console.error('[WhatsApp] Error updating last_message_time:', dbError);
        }

        return { success: true, id: msg.id.id };
    } catch (error: any) {
        console.error('[WhatsApp] Error sending message:', error);

        const errorMessage = error.message || error.toString();

        // Check for session closed, protocol errors, OR TIMEOUT, OR Evaluation failed
        if (errorMessage.includes('Session closed') ||
            errorMessage.includes('Protocol error') ||
            errorMessage.includes('Target closed') ||
            errorMessage.includes('browser has disconnected') ||
            errorMessage.includes('Evaluation failed') ||
            errorMessage.includes('Timeout')) {

            console.error('[WhatsApp] Critical session error or timeout detected. Triggering restart.');
            messageQueue.addLog(`Erro crítico ou timeout (${errorMessage}). Reiniciando WhatsApp...`, 'error');
            addSystemAlert('Erro Crítico WhatsApp', `Erro detectado: ${errorMessage}. Reiniciando serviço...`, 'error');

            // Trigger restart asynchronously so we don't block
            restartClient().catch(console.error);

            throw new Error('CRITICAL_SESSION_ERROR');
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
    await new Promise(resolve => setTimeout(resolve, 2000));

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

export const handleMessageCreate = async (msg: any) => {
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

    // --- AUTO REPLY LOGIC ---
    if (direction === 'incoming') {
        const lowerBody = msg.body.toLowerCase();
        if (lowerBody.includes('tem aula hoje?') || lowerBody.includes('tem aula hoje')) {
            console.log(`🤖 Auto-reply triggered for ${phone}`);
            try {
                await msg.reply('Por qual motivo não teriamos?');
                messageQueue.addLog(`🤖 Auto-resposta enviada para ${phone}`, 'success');
            } catch (e) {
                console.error('Error sending auto-reply:', e);
            }
        }
    }
    // ------------------------

    const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;

    console.log('='.repeat(60));
    console.log(`📱 MENSAGEM ${direction.toUpperCase()} ${direction === 'outgoing' ? 'para' : 'de'} ${phone}`);
    console.log(`📝 Conteúdo: ${msg.body}`);
    messageQueue.addLog(`📱 ${direction === 'outgoing' ? 'Enviada para' : 'Recebida de'} ${phone}: ${msg.body}`, 'info');

    try {
        // Check if this phone is a registered contact
        // Generate variations to check in DB
        const variations = [phone, phoneWithoutCountry];

        // Handle Brazilian 9th digit logic
        if (phone.startsWith('55')) {
            // If it has 13 digits (55 + 2 DDD + 9 + 8 digits), try removing the 9
            if (phone.length === 13) {
                const phoneNo9 = phone.substring(0, 4) + phone.substring(5);
                variations.push(phoneNo9);
                variations.push(phoneNo9.substring(2)); // Also without country code
            }
            // If it has 12 digits (55 + 2 DDD + 8 digits), try adding the 9
            else if (phone.length === 12) {
                const phoneWith9 = phone.substring(0, 4) + '9' + phone.substring(4);
                variations.push(phoneWith9);
                variations.push(phoneWith9.substring(2)); // Also without country code
            }
        }

        console.log(`🔍 Buscando no banco por variações: ${variations.join(', ')}`);

        // Create placeholders for the IN clause (?, ?, ?, ...)
        const placeholders = variations.map(() => '?').join(',');
        const checkStmt = db.prepare(`SELECT cpf, nome, telefone FROM leads WHERE telefone IN (${placeholders})`);
        let contact = checkStmt.get(...variations) as any;

        // Fallback: Try matching by last 8 digits (ignoring DDD and 9th digit)
        if (!contact && phone.length >= 8) {
            const last8 = phone.slice(-8);
            console.log(`⚠️ Contato não encontrado por variações exatas. Tentando fallback pelos últimos 8 dígitos: ${last8}`);

            const fallbackStmt = db.prepare('SELECT cpf, nome, telefone FROM leads WHERE telefone LIKE ?');
            const potentialMatch = fallbackStmt.get(`%${last8}`) as any;

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

            if (msg.hasMedia) {
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

            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO messages (contact_cpf, message_id, direction, body, timestamp, media_url, media_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            const result = insertStmt.run(contact.cpf, msg.id.id, direction, msg.body, messageTime, mediaUrl, mediaType);
            console.log(`💾 Mensagem ${direction} salva no banco! ID: ${result.lastInsertRowid}`);
            messageQueue.addLog(`💾 Mensagem salva! ID: ${result.lastInsertRowid}`, 'success');

            // Update lead's last message
            // Only increment unread_count for incoming messages
            if (direction === 'incoming') {
                const updateStmt = db.prepare(`
                    UPDATE leads
                    SET last_message = ?, 
                        last_message_time = ?,
                        unread_count = COALESCE(unread_count, 0) + 1
                    WHERE cpf = ?
                `);
                updateStmt.run(msg.body || (mediaType ? `[${mediaType}]` : 'Mensagem'), messageTime, contact.cpf);
            } else {
                // For outgoing messages, just update last message without incrementing unread
                const updateStmt = db.prepare(`
                    UPDATE leads
                    SET last_message = ?, 
                        last_message_time = ?
                    WHERE cpf = ?
                `);
                updateStmt.run(msg.body || (mediaType ? `[${mediaType}]` : 'Mensagem'), messageTime, contact.cpf);
            }

            // Fetch and update profile picture asynchronously (don't wait)
            getContactProfilePicture(contact.telefone).then(profilePicUrl => {
                if (profilePicUrl) {
                    try {
                        const updatePicStmt = db.prepare(`
                            UPDATE leads
                            SET profile_image = ?
                            WHERE cpf = ?
                        `);
                        updatePicStmt.run(profilePicUrl, contact.cpf);
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
                const insertLeadStmt = db.prepare(`
                    INSERT INTO leads (cpf, nome, telefone, status, created_at)
                    VALUES (?, ?, ?, 'LEAD', CURRENT_TIMESTAMP)
                `);
                insertLeadStmt.run(tempCpf, contactName, phone);

                // Now we have the contact, proceed to save message
                contact = { cpf: tempCpf, nome: contactName, telefone: phone };
                messageQueue.addLog(`✨ Novo lead criado: ${contactName}`, 'success');

                // Save the message (duplicated logic from above, could be refactored but keeping inline for safety)
                const messageTime = new Date(msg.timestamp * 1000).toISOString();

                let mediaUrl = null;
                let mediaType = null;

                if (msg.hasMedia) {
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

                const insertMsgStmt = db.prepare(`
                    INSERT OR IGNORE INTO messages (contact_cpf, message_id, direction, body, timestamp, media_url, media_type)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                const result = insertMsgStmt.run(contact.cpf, msg.id.id, direction, msg.body, messageTime, mediaUrl, mediaType);
                console.log(`💾 Mensagem ${direction} salva para novo lead! ID: ${result.lastInsertRowid}`);

                // Update lead's last message
                if (direction === 'incoming') {
                    const updateStmt = db.prepare(`
                        UPDATE leads
                        SET last_message = ?, 
                            last_message_time = ?,
                            unread_count = 1
                        WHERE cpf = ?
                    `);
                    updateStmt.run(msg.body || (mediaType ? `[${mediaType}]` : 'Mensagem'), messageTime, contact.cpf);
                }

                // Try to get profile pic
                getContactProfilePicture(contact.telefone).then(profilePicUrl => {
                    if (profilePicUrl) {
                        try {
                            const updatePicStmt = db.prepare('UPDATE leads SET profile_image = ? WHERE cpf = ?');
                            updatePicStmt.run(profilePicUrl, contact.cpf);
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
