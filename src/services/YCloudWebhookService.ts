/**
 * YCloud Webhook Service
 * 
 * Processes webhook events from YCloud:
 * - Inbound messages from WhatsApp users
 * - Message delivery status updates
 * 
 * Follows SRP: This service only handles webhook event processing.
 */

import { pool } from '@/lib/db';
import { yCloudLogger } from '@/lib/logger';
import { getPhoneVariations } from '@/lib/utils/phoneUtils';
import { ActivityService } from '@/services/activityService';
import { ActivityRepository } from '@/lib/repositories/ActivityRepository';
import type {
    YCloudWebhookEvent,
    YCloudInboundMessage,
    YCloudMessageStatus,
    YCloudMessageType
} from '@/types/ycloud';
import { emitNewMessage, emitNewMessageToPhone, emitContactUpdated } from '@/lib/socket/emitter';
import type { NewMessageEvent } from '@/lib/socket/types';
import { YCloudAdapter } from '@/lib/whatsapp/adapters/YCloudAdapter';


// Initialize activity service for logging timeline events
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

interface ContactInfo {
    cpf: string;
    nome: string;
    telefone: string;
}

export class YCloudWebhookService {
    /**
     * Process a webhook event from YCloud
     */
    async processEvent(event: YCloudWebhookEvent): Promise<{ processed: boolean; details?: string }> {
        yCloudLogger.info('Processing YCloud webhook event', {
            eventId: event.id,
            eventType: event.type
        });

        try {
            switch (event.type) {
                case 'whatsapp.inbound_message.received':
                    if (event.whatsappInboundMessage) {
                        await this.handleInboundMessage(event.whatsappInboundMessage);
                        return { processed: true, details: 'Inbound message processed' };
                    }
                    return { processed: false, details: 'Missing whatsappInboundMessage payload' };

                case 'whatsapp.message.updated':
                    if (event.whatsappMessage) {
                        await this.handleMessageStatusUpdate(event.whatsappMessage);
                        return { processed: true, details: 'Status update processed' };
                    }
                    return { processed: false, details: 'Missing whatsappMessage payload' };

                default:
                    yCloudLogger.warn('Unknown YCloud event type', { type: event.type });
                    return { processed: false, details: `Unknown event type: ${event.type}` };
            }
        } catch (error) {
            yCloudLogger.error('Error processing YCloud webhook event', {
                eventId: event.id,
                error
            });
            throw error;
        }
    }

    /**
     * Handle incoming message from WhatsApp user
     */
    private async handleInboundMessage(message: YCloudInboundMessage): Promise<void> {
        const phone = this.normalizePhone(message.from);
        const messageBody = this.extractMessageBody(message);
        const mediaType = this.getMediaType(message.type);
        const messageTime = new Date(message.sendTime).toISOString();

        // Push to active YCloudAdapter if it exists
        try {
            const { WhatsAppProviderFactory } = await import('@/lib/whatsapp/factory/WhatsAppProviderFactory');
            const provider = await WhatsAppProviderFactory.getProvider();

            // Type Guard: Check if provider is YCloudAdapter
            if (provider instanceof YCloudAdapter) {
                provider.pushInboundMessage(message);
            }
        } catch (e) {
            yCloudLogger.error('Error pushing message to YCloudAdapter:', e);
        }

        yCloudLogger.info('Processing inbound message via YCloud', {
            from: phone,
            type: message.type,
            messageId: message.id
        });

        // Find or create contact
        let contact = await this.findContact(phone);

        if (!contact) {
            // Create new lead for unknown contact
            contact = await this.createNewLead(phone, message);
            yCloudLogger.info('Created new lead for YCloud message', { phone, cpf: contact.cpf });
        }

        // Save message to database
        await this.saveMessage(contact, message.id, messageBody, messageTime, mediaType);

        // Update lead's last message info
        await this.updateLeadLastMessage(contact.cpf, messageBody, messageTime, mediaType);


        // Log activity for incoming message
        await activityService.logWhatsAppReceived(
            contact.cpf,
            messageBody
        );

        // Emit Socket Events for Real-time Update
        const socketMessage: NewMessageEvent['message'] = {
            id: 0,
            message_id: message.id,
            direction: 'incoming',
            body: messageBody,
            media_url: null, // We need to extract media URL from message if possible, or use placeholder
            media_type: mediaType,
            timestamp: messageTime,
            status: 'received'
        };

        // Extract media URL if present
        if (message.image) socketMessage.media_url = message.image.link || null;
        else if (message.video) socketMessage.media_url = message.video.link || null;
        else if (message.audio) socketMessage.media_url = message.audio.link || null;
        else if (message.document) socketMessage.media_url = message.document.link || null;

        // Emit to CPF room
        emitNewMessage({
            contactCpf: contact.cpf,
            contactName: contact.nome,
            message: socketMessage
        });

        // Emit to Phone room
        emitNewMessageToPhone(phone, {
            contactName: contact.nome,
            message: socketMessage
        });

        // Emit Contact Update
        emitContactUpdated({
            cpf: contact.cpf,
            updates: {
                last_message: messageBody,
                last_message_time: messageTime,
                last_message_direction: 'incoming',
                unread_count: -1 // increment
            }
        });

        yCloudLogger.info('Inbound YCloud message processed', {
            contactCpf: contact.cpf,
            messageId: message.id
        });
    }

    /**
     * Handle message status update (sent, delivered, read, failed)
     */
    private async handleMessageStatusUpdate(status: YCloudMessageStatus): Promise<void> {
        yCloudLogger.info('Processing message status update via YCloud', {
            messageId: status.id,
            status: status.status,
            to: status.to
        });

        // Map YCloud status to our internal status
        const internalStatus = this.mapStatus(status.status);

        // Update message status in database (if we track by external ID)
        // For now, log the status update
        if (status.status === 'failed' && status.error) {
            yCloudLogger.error('YCloud message failed', {
                messageId: status.id,
                to: status.to,
                errorCode: status.error.code,
                errorMessage: status.error.message
            });
        }

        // Update message_history table if we have the ycloud message ID
        await pool.query(`
            UPDATE message_history 
            SET status = $1, updated_at = NOW()
            WHERE provider_message_id = $2
        `, [internalStatus, status.id]);

        yCloudLogger.debug('Message status updated', {
            messageId: status.id,
            newStatus: internalStatus
        });
    }

    /**
     * Find contact in database by phone variations
     */
    private async findContact(phone: string): Promise<ContactInfo | null> {
        const variations = getPhoneVariations(phone);

        const placeholders = variations.map((_, i) => `$${i + 1}`).join(',');
        const result = await pool.query(`
            SELECT cpf, nome, telefone FROM leads 
            WHERE telefone IN (${placeholders})
            ORDER BY CASE WHEN cpf != telefone THEN 0 ELSE 1 END, cpf
            LIMIT 1
        `, variations);

        return result.rows[0] || null;
    }

    /**
     * Create a new lead for unknown contact
     */
    private async createNewLead(phone: string, message: YCloudInboundMessage): Promise<ContactInfo> {
        const nome = message.customerProfile?.name || `Lead YCloud ${phone.slice(-4)}`;
        const normalizedPhone = this.normalizePhone(phone);

        // Use phone as CPF when creating from message
        await pool.query(`
            INSERT INTO leads (cpf, nome, telefone, origem, created_at)
            VALUES ($1, $2, $3, 'ycloud', NOW())
            ON CONFLICT (cpf) DO NOTHING
        `, [normalizedPhone, nome, normalizedPhone]);

        return {
            cpf: normalizedPhone,
            nome,
            telefone: normalizedPhone
        };
    }

    /**
     * Save message to database
     */
    private async saveMessage(
        contact: ContactInfo,
        messageId: string,
        content: string,
        timestamp: string,
        mediaType: string | null
    ): Promise<void> {
        await pool.query(`
            INSERT INTO messages (contact_phone, id, content, from_me, timestamp, type)
            VALUES ($1, $2, $3, false, $4, $5)
            ON CONFLICT (id) DO NOTHING
        `, [contact.cpf, messageId, content, timestamp, mediaType || 'text']);
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
        // Truncate body for preview
        const preview = body.length > 100 ? body.substring(0, 100) + '...' : body;
        const displayContent = mediaType && mediaType !== 'text'
            ? `[${mediaType.toUpperCase()}] ${preview}`
            : preview;

        await pool.query(`
            UPDATE leads 
            SET 
                last_message = $1,
                last_message_time = $2,
                unread_count = COALESCE(unread_count, 0) + 1
            WHERE cpf = $3
        `, [displayContent, messageTime, cpf]);
    }

    /**
     * Extract message body based on message type
     */
    private extractMessageBody(message: YCloudInboundMessage): string {
        switch (message.type) {
            case 'text':
                return message.text?.body || '';
            case 'image':
                return message.image?.caption || '[Imagem]';
            case 'video':
                return message.video?.caption || '[Vídeo]';
            case 'audio':
                return '[Áudio]';
            case 'document':
                return message.document?.filename || '[Documento]';
            case 'location':
                return `[Localização: ${message.location?.name || message.location?.address || 'Ver no mapa'}]`;
            case 'contacts':
                return `[Contato: ${message.contacts?.[0]?.name?.formatted_name || 'Contato'}]`;
            case 'button':
                return message.button?.text || '[Botão]';
            case 'interactive':
                return message.interactive?.button_reply?.title ||
                    message.interactive?.list_reply?.title ||
                    '[Resposta Interativa]';
            default:
                return '[Mensagem]';
        }
    }

    /**
     * Get media type from message type
     */
    private getMediaType(type: YCloudMessageType): string | null {
        switch (type) {
            case 'text':
                return null;
            case 'image':
                return 'image';
            case 'video':
                return 'video';
            case 'audio':
                return 'audio';
            case 'document':
                return 'document';
            case 'location':
                return 'location';
            case 'contacts':
                return 'contact';
            default:
                return null;
        }
    }

    /**
     * Map YCloud status to internal status
     */
    private mapStatus(status: string): string {
        switch (status) {
            case 'accepted':
                return 'pending';
            case 'sent':
                return 'sent';
            case 'delivered':
                return 'delivered';
            case 'read':
                return 'read';
            case 'failed':
                return 'failed';
            default:
                return 'unknown';
        }
    }

    /**
     * Normalize phone number (remove non-digits, ensure country code)
     */
    private normalizePhone(phone: string): string {
        let cleaned = phone.replace(/\D/g, '');
        if (!cleaned.startsWith('55')) {
            cleaned = '55' + cleaned;
        }
        return cleaned;
    }
}

// Export singleton instance
export const yCloudWebhookService = new YCloudWebhookService();
