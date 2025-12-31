/**
 * WhatsApp Message Event Handler
 * 
 * Handles incoming and outgoing message events:
 * - Processing message_create events
 * - Saving messages to database
 * - Updating lead information
 * - Triggering auto-replies
 * - Emitting socket events
 * - Creating new leads for unknown contacts
 * 
 * Following:
 * - SRP: Only handles message event processing
 * - DIP: Depends on abstractions for services
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { whatsappLogger } from '@/lib/logger';
import type { WhatsAppStateManager } from '../state';
import type { ContactInfo, MessageDirection } from '../types';
import type { WhatsAppMessage } from '../../types';
import { pool } from '../../db';
import { messageQueue } from '../../messageQueue';
import { ActivityRepository } from '../../repositories/ActivityRepository';
import { ActivityService } from '../../../services/activityService';
import { emitNewMessage, emitContactUpdated, emitNewMessageToPhone } from '../../socket/emitter';
import { getPhoneVariations } from '../../utils/phoneUtils';

// Activity service for logging timeline events
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

export class MessageEventHandler {
    constructor(
        private state: WhatsAppStateManager,
        private autoReplyEnabled: boolean = true
    ) { }

    /**
     * Get profile picture for a contact
     */
    private async getContactProfilePicture(phone: string): Promise<string | null> {
        if (!this.state.isClientAvailable()) {
            return null;
        }

        try {
            const chatId = `${phone}@c.us`;
            return await this.state.client!.getProfilePicUrl(chatId);
        } catch {
            return null;
        }
    }

    /**
     * Download and save media from message
     */
    private async downloadMedia(msg: WhatsAppMessage): Promise<{ url: string | null; type: string | null }> {
        if (!msg.hasMedia || !msg.downloadMedia) {
            return { url: null, type: null };
        }

        try {
            const media = await msg.downloadMedia();
            if (!media) {
                return { url: null, type: null };
            }

            const extension = media.mimetype.split('/')[1].split(';')[0];
            const filename = `${uuidv4()}.${extension}`;
            const uploadDir = path.join(process.cwd(), 'public', 'uploads');

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filepath = path.join(uploadDir, filename);
            fs.writeFileSync(filepath, media.data, 'base64');

            const mediaUrl = `/uploads/${filename}`;
            const mediaType = media.mimetype.startsWith('image') ? 'image' :
                media.mimetype.startsWith('audio') ? 'audio' :
                    media.mimetype.startsWith('video') ? 'video' : 'document';

            whatsappLogger.debug(` Media saved: ${mediaUrl} (${mediaType})`);
            return { url: mediaUrl, type: mediaType };
        } catch (mediaError) {
            whatsappLogger.error(' Error downloading media:', mediaError);
            return { url: null, type: null };
        }
    }

    /**
     * Find contact in database by phone variations
     */
    private async findContact(phone: string): Promise<ContactInfo | null> {
        const variations = getPhoneVariations(phone);
        whatsappLogger.debug(`🔍 Buscando no banco por variações: ${variations.join(', ')}`);

        // Create placeholders for PostgreSQL ($1, $2, etc)
        const placeholders = variations.map((_, i) => `$${i + 1}`).join(',');
        const result = await pool.query(`
      SELECT cpf, nome, telefone FROM leads 
      WHERE telefone IN (${placeholders})
      ORDER BY CASE WHEN cpf != telefone THEN 0 ELSE 1 END, cpf
      LIMIT 1
    `, variations);

        let contact = result.rows[0] as ContactInfo | undefined;

        // Fallback: Try matching by last 8 digits
        if (!contact && phone.length >= 8) {
            const last8 = phone.slice(-8);
            whatsappLogger.debug(`⚠️ Contato não encontrado por variações exatas. Tentando fallback pelos últimos 8 dígitos: ${last8}`);

            const fallbackResult = await pool.query(
                'SELECT cpf, nome, telefone FROM leads WHERE telefone LIKE $1',
                [`%${last8}`]
            );
            contact = fallbackResult.rows[0] as ContactInfo | undefined;

            if (contact) {
                whatsappLogger.debug(`✅ Contato encontrado via fallback (últimos 8 dígitos): ${contact.nome}`);
            }
        }

        return contact || null;
    }

    /**
     * Save message to database
     */
    private async saveMessage(
        contact: ContactInfo,
        msg: WhatsAppMessage,
        direction: MessageDirection,
        messageTime: string
    ): Promise<number> {
        const insertResult = await pool.query(`
      INSERT INTO messages (contact_phone, id, content, from_me, timestamp, type)
      VALUES ($1, $2, $3, $4, $5, 'text')
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `, [contact.cpf, msg.id.id, msg.body, direction === 'outgoing', messageTime]);

        const insertedId = insertResult.rows[0]?.id || 0;
        whatsappLogger.debug(`💾 Mensagem ${direction} salva no banco! ID: ${insertedId}`);
        messageQueue.addLog(`💾 Mensagem salva! ID: ${insertedId}`, 'success');

        return insertedId;
    }

    /**
     * Update lead's last message information
     */
    private async updateLeadLastMessage(
        cpf: string,
        body: string,
        messageTime: string,
        mediaType: string | null
    ): Promise<void> {
        whatsappLogger.debug(` 🔄 Tentando atualizar last_message para CPF: ${cpf}`);

        try {
            const updateResult = await pool.query(`
        UPDATE leads 
        SET last_message = $1,
            last_message_time = $2
        WHERE cpf = $3
      `, [body || (mediaType ? `[${mediaType}]` : 'Mensagem'), messageTime, cpf]);

            whatsappLogger.debug(`✅ Lead ${cpf} UPDATE executado! Changes: ${updateResult.rowCount}`);

            if (updateResult.rowCount === 0) {
                whatsappLogger.warn(`⚠️ UPDATE não afetou nenhuma linha! CPF ${cpf} pode não existir na tabela leads`);
            }
        } catch (updateError) {
            whatsappLogger.error(' ❌ Error updating lead last_message:', updateError);
        }
    }

    /**
     * Emit socket events for real-time updates
     */
    private emitSocketEvents(
        contact: ContactInfo,
        phone: string,
        insertedId: number,
        msg: WhatsAppMessage,
        direction: MessageDirection,
        messageTime: string,
        mediaUrl: string | null,
        mediaType: string | null
    ): void {
        if (direction !== 'incoming') {
            whatsappLogger.debug(`[Socket] ⏭️ Skipping emit for OUTGOING message (no notification needed)`);
            return;
        }

        try {
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
                    media_type: mediaType as 'image' | 'audio' | 'video' | 'document' | null,
                    timestamp: messageTime,
                    status: 'sent'
                }
            });

            // Also emit to phone room (for WhatsApp POC)
            const emittedToPhone = emitNewMessageToPhone(phone, {
                contactName: contact.nome || contact.telefone,
                message: {
                    id: insertedId,
                    message_id: msg.id.id,
                    direction,
                    body: msg.body,
                    media_url: mediaUrl,
                    media_type: mediaType as 'image' | 'audio' | 'video' | 'document' | null,
                    timestamp: messageTime,
                    status: 'sent'
                }
            });

            if (emittedToCpf || emittedToPhone) {
                whatsappLogger.debug(`[Socket] ✅ Event emitted for INCOMING message from CPF:${contact.cpf} Phone:${phone}`);
            } else {
                whatsappLogger.error(`[Socket] ❌ FAILED to emit - Socket.io not ready!`);
            }
        } catch (socketError) {
            whatsappLogger.warn('[Socket] Could not emit message event:', socketError);
        }
    }

    /**
     * Handle incoming message for unread count and activity logging
     */
    private async handleIncomingMessageUpdates(
        contact: ContactInfo,
        body: string,
        messageTime: string,
        mediaType: string | null
    ): Promise<void> {
        // Increment unread count
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
                    last_message: body || (mediaType ? `[${mediaType}]` : 'Mensagem'),
                    last_message_time: messageTime,
                    last_message_direction: 'incoming',
                    unread_count: -1 // Signal to increment on client side
                }
            });
        } catch (socketError) {
            whatsappLogger.warn('[Socket] Could not emit contact update:', socketError);
        }

        // Log activity: WhatsApp received
        try {
            activityService.logWhatsAppReceived(contact.cpf, body || `[${mediaType || 'mídia'}]`);
        } catch (activityError) {
            whatsappLogger.error(' Error logging activity:', activityError);
        }
    }

    /**
     * Create a new lead for unknown contact
     */
    private async createNewLead(phone: string, msg: WhatsAppMessage): Promise<ContactInfo> {
        whatsappLogger.debug(`⚠️ Contato não encontrado. Criando novo lead para: ${phone}`);

        // Get contact info
        let contactName = phone;
        try {
            const chatContact = await msg.getContact();
            contactName = chatContact.pushname || chatContact.name || chatContact.number || phone;
        } catch (e) {
            whatsappLogger.error('Error fetching contact info:', e);
            contactName = (msg as any)._data?.notifyName || phone;
        }

        const tempCpf = phone; // Use phone as temporary CPF

        await pool.query(`
      INSERT INTO leads (cpf, nome, telefone, status, created_at)
      VALUES ($1, $2, $3, 'LEAD', NOW())
    `, [tempCpf, contactName, phone]);

        messageQueue.addLog(`✨ Novo lead criado: ${contactName}`, 'success');

        return { cpf: tempCpf, nome: contactName, telefone: phone };
    }

    /**
     * Handle auto-reply for incoming messages
     */
    private async handleAutoReply(phone: string, body: string, msg: WhatsAppMessage): Promise<void> {
        if (!this.autoReplyEnabled || !body || !body.trim()) {
            return;
        }

        try {
            // Import auto-reply service dynamically to avoid circular dependencies
            const { autoReplyService } = await import('../../../services/autoReplyService');

            whatsappLogger.debug(`🤖 Processing auto-reply for message from ${phone}: "${body}"`);

            const response = await autoReplyService.processIncomingMessage(phone, body);

            if (response && typeof response === 'string') {
                whatsappLogger.debug(`🤖 Sending auto-reply to ${phone}: "${response}"`);

                // Add a small delay to seem more human
                await new Promise(resolve => setTimeout(resolve, 1500));

                if (msg.reply) {
                    await msg.reply(response);
                    messageQueue.addLog(`🤖 Auto-resposta enviada para ${phone}`, 'success');
                    whatsappLogger.debug(`✅ Auto-reply sent successfully to ${phone}`);
                }
            } else {
                whatsappLogger.debug(`ℹ️ No auto-reply triggered for message from ${phone}`);
            }
        } catch (error) {
            whatsappLogger.error(' Error processing auto-reply:', error);
        }
    }

    /**
     * Main handler for message_create event
     */
    async handle(msg: WhatsAppMessage): Promise<void> {
        whatsappLogger.debug('🔔 EVENT message_create DISPARADO!');

        // Only process direct messages (not groups)
        if (!msg.from.endsWith('@c.us') && !msg.to?.endsWith('@c.us')) {
            return;
        }

        // Determine phone number and direction
        let phone: string;
        let direction: MessageDirection;

        if (msg.fromMe) {
            phone = msg.to?.replace('@c.us', '') || '';
            direction = 'outgoing';
        } else {
            phone = msg.from.replace('@c.us', '');
            direction = 'incoming';
        }

        if (!phone) return;

        // Handle auto-reply for incoming messages
        if (direction === 'incoming') {
            await this.handleAutoReply(phone, msg.body, msg);
        }

        whatsappLogger.debug('='.repeat(60));
        whatsappLogger.debug(`📱 MENSAGEM ${direction.toUpperCase()} ${direction === 'outgoing' ? 'para' : 'de'} ${phone}`);
        whatsappLogger.debug(`📝 Conteúdo: ${msg.body}`);
        messageQueue.addLog(`📱 ${direction === 'outgoing' ? 'Enviada para' : 'Recebida de'} ${phone}: ${msg.body}`, 'info');

        try {
            // Find or create contact
            let contact = await this.findContact(phone);

            const messageTime = new Date(msg.timestamp * 1000).toISOString();
            const { url: mediaUrl, type: mediaType } = await this.downloadMedia(msg);

            if (contact) {
                whatsappLogger.debug(`✅ Contato cadastrado: ${contact.nome} (CPF: ${contact.cpf}, Tel: ${contact.telefone})`);
                messageQueue.addLog(`✅ ${contact.nome}: ${msg.body}`, 'success');

                // Save message
                const insertedId = await this.saveMessage(contact, msg, direction, messageTime);

                // Emit socket events (only for incoming)
                this.emitSocketEvents(contact, phone, insertedId, msg, direction, messageTime, mediaUrl, mediaType);

                // Update lead's last message
                await this.updateLeadLastMessage(contact.cpf, msg.body, messageTime, mediaType);

                // Handle incoming-specific updates
                if (direction === 'incoming') {
                    await this.handleIncomingMessageUpdates(contact, msg.body, messageTime, mediaType);
                }

                // Update profile picture asynchronously
                this.getContactProfilePicture(contact.telefone).then(async (profilePicUrl) => {
                    if (profilePicUrl) {
                        try {
                            await pool.query(
                                'UPDATE leads SET profile_image = $1 WHERE cpf = $2',
                                [profilePicUrl, contact!.cpf]
                            );
                            whatsappLogger.debug(` ✓ Profile picture updated for ${contact!.nome}`);
                        } catch (err) {
                            whatsappLogger.error(' Error updating profile picture:', err);
                        }
                    }
                }).catch(err => {
                    whatsappLogger.error(' Error fetching profile picture:', err);
                });

            } else {
                // Create new lead
                try {
                    contact = await this.createNewLead(phone, msg);

                    // Save message for new lead
                    const insertedId = await this.saveMessage(contact, msg, direction, messageTime);
                    whatsappLogger.debug(`💾 Mensagem ${direction} salva para novo lead! ID: ${insertedId}`);

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

                    // Update profile picture asynchronously
                    this.getContactProfilePicture(contact.telefone).then(async (profilePicUrl) => {
                        if (profilePicUrl) {
                            try {
                                await pool.query('UPDATE leads SET profile_image = $1 WHERE cpf = $2', [profilePicUrl, contact!.cpf]);
                            } catch (err) {
                                whatsappLogger.error(' Error updating profile picture:', err);
                            }
                        }
                    });

                } catch (err) {
                    whatsappLogger.error('Erro ao criar novo lead:', err);
                    messageQueue.addLog(`❌ Erro ao criar lead: ${err}`, 'error');
                }
            }

        } catch (error) {
            whatsappLogger.error('Erro ao processar mensagem:', error);
            messageQueue.addLog(`❌ Erro: ${error}`, 'error');
        }

        whatsappLogger.debug('='.repeat(60));
    }
}
