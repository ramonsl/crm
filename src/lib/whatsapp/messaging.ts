/**
 * WhatsApp Messenger - Message Sending Service
 * 
 * Handles all message sending operations:
 * - Text messages
 * - Media messages (images, audio, video, documents)
 * - Fallback strategies for Brazilian numbers
 * - Error handling and critical error detection
 * 
 * Following:
 * - SRP: Only handles message sending
 * - DIP: Depends on state, validator, and health service abstractions
 */

import fs from 'fs';
import path from 'path';
import { MessageMedia } from 'whatsapp-web.js';
import type { WhatsAppStateManager } from './state';
import type { HealthCheckService } from './health';
import { WhatsAppValidator } from './validation';
import type { SendMessageOptions, SendMessageResult, MessageContent } from './types';
import { pool } from '../db';
import { messageQueue } from '../messageQueue';
import { WHATSAPP_CONFIG } from '../constants';

export class WhatsAppMessenger {
    private validator: WhatsAppValidator;

    constructor(
        private state: WhatsAppStateManager,
        private healthService: HealthCheckService
    ) {
        this.validator = new WhatsAppValidator(state);
    }

    /**
     * Helper to timeout promises
     */
    private withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
            )
        ]);
    }

    /**
     * Create MessageMedia from URL or local path
     */
    private async createMediaContent(mediaUrl: string, mediaType?: string): Promise<MessageMedia | null> {
        try {
            if (mediaUrl.startsWith('/')) {
                // Local file path
                const absolutePath = path.join(process.cwd(), 'public', mediaUrl);
                console.log(`[WhatsApp] Reading media from file: ${absolutePath}`);
                const fileData = fs.readFileSync(absolutePath, { encoding: 'base64' });
                const filename = path.basename(absolutePath);
                const mime = mediaType || 'application/octet-stream';
                const media = new MessageMedia(mime, fileData, filename);
                console.log(`[WhatsApp] Media created manually. Mime: ${mime}`);
                return media;
            } else {
                // Remote URL
                console.log(`[WhatsApp] Creating media from URL: ${mediaUrl}`);
                const media = await MessageMedia.fromUrl(mediaUrl);
                console.log(`[WhatsApp] Media created from URL. Mime: ${media.mimetype}`);
                return media;
            }
        } catch (e) {
            console.error('[WhatsApp] Error creating media:', e);
            return null;
        }
    }

    /**
     * Update lead's last message in database
     */
    private async updateLeadLastMessage(phone: string, message: string): Promise<void> {
        try {
            const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
            await pool.query(
                'UPDATE leads SET last_message_time = NOW(), last_message = $1 WHERE telefone = $2 OR telefone = $3',
                [`(Enviada) ${message}`, phone, phoneWithoutCountry]
            );
        } catch (dbError) {
            console.error('[WhatsApp] Error updating last_message_time:', dbError);
        }
    }

    /**
     * Send message with fallback for Brazilian numbers (try 12-digit then 13-digit)
     */
    private async sendWithFallback(
        phone: string,
        message: string,
        options?: SendMessageOptions
    ): Promise<SendMessageResult> {
        let formattedPhone = this.validator.normalizePhone(phone);

        // Only applies to Brazilian numbers
        if (!formattedPhone.startsWith('55')) {
            // International fallback - just try the formatted number
            const chatId = `${formattedPhone}@c.us`;
            return this.sendToChat(chatId, message, options);
        }

        // Construct both variations for Brazilian numbers
        let phone12: string;
        let phone13: string;

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
            const result = await this.sendToChat(chatId12, message, options);
            if (result.success) {
                messageQueue.addLog(`✅ Envio forçado (sem 9) aceito!`, 'success');
                await this.updateLeadLastMessage(phone12, message);
                return result;
            }
        } catch (error1) {
            const error1Message = error1 instanceof Error ? error1.message : String(error1);
            console.warn(`[WhatsApp] Force Send 12-digit failed: ${error1Message}`);

            // Check if it's a "not WhatsApp" error
            if (error1Message.includes('No LID for user')) {
                const friendlyMessage = `Número ${phone} não é WhatsApp`;
                console.error(`[WhatsApp] ❌ ${friendlyMessage}`);
                messageQueue.addLog(`❌ ${friendlyMessage}`, 'error');
                throw new Error(friendlyMessage);
            }

            messageQueue.addLog(`❌ Falha na tentativa 1: ${error1Message}`, 'error');
        }

        // Priority 2: Try 13-digit (New/9th digit)
        const chatId13 = `${phone13}@c.us`;
        console.log(`[WhatsApp] Force Send Attempt 2: ${chatId13}`);
        messageQueue.addLog(`Tentativa 2 (Forçada): ${chatId13}`, 'info');

        try {
            const result = await this.sendToChat(chatId13, message, options);
            if (result.success) {
                messageQueue.addLog(`✅ Envio forçado (com 9) aceito!`, 'success');
                await this.updateLeadLastMessage(phone13, message);
                return result;
            }
        } catch (error2) {
            const error2Message = error2 instanceof Error ? error2.message : String(error2);
            console.error(`[WhatsApp] Force Send 13-digit failed: ${error2Message}`);

            if (error2Message.includes('No LID for user')) {
                const friendlyMessage = `Número ${phone} não é WhatsApp`;
                console.error(`[WhatsApp] ❌ ${friendlyMessage}`);
                messageQueue.addLog(`❌ ${friendlyMessage}`, 'error');
                throw new Error(friendlyMessage);
            }

            messageQueue.addLog(`❌ Falha na tentativa 2: ${error2Message}`, 'error');
            throw error2;
        }

        throw new Error('All fallback attempts failed');
    }

    /**
     * Send message to a specific chatId
     */
    private async sendToChat(
        chatId: string,
        message: string,
        options?: SendMessageOptions
    ): Promise<SendMessageResult> {
        if (!this.state.client) {
            throw new Error('WhatsApp client is null');
        }

        let content: MessageContent = message;
        if (options?.mediaUrl) {
            const media = await this.createMediaContent(options.mediaUrl, options.mediaType);
            if (media) {
                content = media;
            }
        }

        const msg = await this.withTimeout(
            this.state.client.sendMessage(chatId, content, {
                caption: options?.mediaUrl ? message : undefined
            }),
            15000,
            'Timeout sending message'
        );

        console.log(`[WhatsApp] Message sent successfully. ID: ${msg.id.id} | ACK: ${msg.ack} | To: ${msg.to}`);
        return { success: true, id: msg.id.id };
    }

    /**
     * Send a message to a phone number
     * Main entry point for message sending
     */
    async send(phone: string, message: string, options?: SendMessageOptions): Promise<SendMessageResult> {
        console.log(`[WhatsApp] Attempting to send message to ${phone}`);
        messageQueue.addLog(`Tentando enviar para ${phone}...`, 'info');

        // Robust check of client state
        const clientReady = await this.healthService.isClientReady();

        if (!clientReady) {
            const errorMsg = `Cliente WhatsApp não está pronto. Estado atual: ${this.state.status}`;
            console.error(`[WhatsApp] ${errorMsg}`);
            messageQueue.addLog(`Erro: ${errorMsg}`, 'error');

            // Try to initialize client if it doesn't exist
            if (!this.state.client) {
                console.log('[WhatsApp] Client não existe. Não é possível enviar mensagem.');
                throw new Error('WhatsApp client is not ready and could not be initialized');
            } else {
                throw new Error('WhatsApp client is not ready');
            }
        }

        console.log('[WhatsApp] ✅ Cliente verificado e pronto para enviar mensagem');

        let chatId = '';

        // If phone already has @c.us suffix, use it directly
        if (phone.endsWith('@c.us')) {
            chatId = phone;
            console.log(`[WhatsApp] Using provided chatId: ${chatId}`);
            messageQueue.addLog(`Usando ID fornecido: ${chatId}`, 'info');
        } else {
            // Use validation to resolve the WhatsApp ID
            const resolvedId = await this.validator.validate(phone);

            if (resolvedId) {
                chatId = resolvedId;
                console.log(`[WhatsApp] Number resolved to: ${chatId}`);
                messageQueue.addLog(`Número encontrado no WhatsApp: ${chatId}`, 'info');
            } else {
                console.warn('[WhatsApp] Number not found in WhatsApp registry. Using fallback strategy...');
                messageQueue.addLog(`⚠️ Número não validado. Iniciando envio forçado...`, 'info');

                // Fallback: Try to send using the fallback strategy
                return this.sendWithFallback(phone, message, options);
            }
        }

        try {
            console.log(`[WhatsApp] Sending message to chatId: ${chatId}`);

            const result = await this.sendToChat(chatId, message, options);

            messageQueue.addLog(`Mensagem enviada! ID: ${result.id}`, 'success');

            // Update last_message_time in DB
            const usedNumber = chatId.replace('@c.us', '');
            await this.updateLeadLastMessage(usedNumber, message);

            return result;
        } catch (error: unknown) {
            console.error('[WhatsApp] Error sending message:', error);

            const errorMessage = error instanceof Error ? error.message : String(error);

            // LID errors mean the number is invalid - NOT critical
            if (errorMessage.includes('No LID for user')) {
                const friendlyMessage = `Número ${phone} não é WhatsApp`;
                console.error(`[WhatsApp] ❌ ${friendlyMessage}`);
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

                // Check if we can restart (not in a restart loop)
                if (this.healthService.canRestart()) {
                    console.log('[WhatsApp] Dentro dos limites de restart. Reiniciando WhatsApp...');
                    messageQueue.addLog('🔄 Reiniciando WhatsApp devido a erro crítico...', 'info');

                    // Wait before restart to allow things to settle
                    await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONFIG.RESTART_COOLDOWN_MS));

                    // Trigger reconnect asynchronously
                    this.healthService.attemptReconnect().catch(console.error);

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
    }
}
