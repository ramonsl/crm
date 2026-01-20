
import { pool } from '@/lib/db';
import { whatsappLogger } from '@/lib/logger';
import { messageQueue } from '@/lib/messageQueue';
import { emitNewMessage, emitContactUpdated, emitNewMessageToPhone } from '@/lib/socket/emitter';
import { getPhoneVariations } from '@/lib/utils/phoneUtils';
import type { WhatsAppMessage } from '@/lib/whatsapp/IWhatsAppProvider';

export interface ContactInfo {
    cpf: string;
    nome: string;
    telefone: string;
}

export class BaileysMessageHandler {
    constructor(private autoReplyEnabled: boolean = true) { }

    /**
     * Find contact in database by phone variations
     */
    private async findContact(phone: string): Promise<ContactInfo | null> {
        const variations = getPhoneVariations(phone);

        // Create placeholders for PostgreSQL ($1, $2, etc)
        const placeholders = variations.map((_, i) => `$${i + 1}`).join(',');

        // Query to find contact by any phone variation
        // Query to find contact by any phone variation
        const result = await pool.query(`
            SELECT cpf, nome, telefone FROM leads 
            WHERE telefone IN (${placeholders})
            ORDER BY CASE WHEN cpf != telefone THEN 0 ELSE 1 END, cpf
            LIMIT 1
        `, variations);

        const contact = result.rows[0] as ContactInfo | undefined;

        if (contact) {
            whatsappLogger.debug(`Contact found: ${contact.nome} (${contact.telefone}) for variations: ${variations.join(', ')}`);
        } else {
            whatsappLogger.debug(`No contact found for variations: ${variations.join(', ')}`);
        }

        // REMOVED FALLBACK: The previous fallback matching last 8 digits was ignoring DDD 
        // and causing wrong contact attribution (e.g. 51... matching 48...).
        // getPhoneVariations() already handles 9th digit variations correctly with strict matching.

        return contact || null;
    }

    /**
     * Save message to database
     */
    private async saveMessage(
        contact: ContactInfo,
        msg: WhatsAppMessage,
        insertTime: string
    ): Promise<number> {
        const insertResult = await pool.query(`
            INSERT INTO messages (contact_phone, id, content, from_me, timestamp, type)
            VALUES ($1, $2, $3, $4, $5, 'text')
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        `, [contact.cpf, msg.id, msg.body, msg.fromMe, insertTime]);

        const insertedId = insertResult.rows[0]?.id || 0; // If duplicate, id might be missing or we need to query it? 
        // Actually for conflict do nothing, it returns nothing. 
        // Use 0 as fallback, duplicate message should not re-trigger events ideally.

        return Number(insertedId); // Ensure it's number if possible, though ID implies string in schema? 
        // Schema says id is text (primary key). Wait. 
        // Messages table id is TEXT. 
        // Previous handler code said "insertedId: number". Let's check schema.
        // Schema: id: { type: 'text', primaryKey: true }
        // So safeMessage returns string?
        // Legacy handler returns number? Let's check legacy handler again.
        // Legacy handler: `RETURNING id`. If id is UUID/String, it returns string.
        // Legacy handler typed it as Promise<number>. Might be a bug there or I misread.
        // Ah, legacy handler return `insertedId` which is `insertResult.rows[0]?.id || 0`.
        // If the ID is a string (WWebJS message ID), returning 0 is weird.
        // But for Baileys, ID is string.

        return 0; // We don't need the internal DB ID if we use the WhatsApp ID.
    }

    /**
     * Create a new lead for unknown contact
     */
    private async createNewLead(phone: string): Promise<ContactInfo> {
        whatsappLogger.debug(`⚠️ Contato não encontrado. Criando novo lead para: ${phone}`);

        const contactName = phone;
        const tempCpf = phone; // Use phone as temporary CPF

        await pool.query(`
            INSERT INTO leads (cpf, nome, telefone, status, created_at)
            VALUES ($1, $2, $3, 'LEAD', NOW())
            ON CONFLICT (cpf) DO NOTHING
        `, [tempCpf, contactName, phone]);

        messageQueue.addLog(`✨ Novo lead criado: ${contactName}`, 'success');

        return { cpf: tempCpf, nome: contactName, telefone: phone };
    }

    /**
     * Handle incoming/outgoing message
     */
    async handle(msg: WhatsAppMessage): Promise<void> {
        // Skip groups for now (simplified)
        if (msg.isGroup) return;

        const phone = msg.fromMe ? (msg.id.length > 15 ? '' : '') : msg.from;
        // For outgoing, we don't easily know the 'to' from the normalized msg object if it's not passed.
        // Baileys.ts normalized object:
        // from: from.replace...
        // doesn't have 'to'. 
        // If fromMe is true, 'from' is ME. Who is 'to'? 
        // Baileys.ts logic: "const from = msg.key.remoteJid". 
        // If fromMe is true, remoteJid is the RECIPIENT.
        // So 'from' variable in Baileys.ts IS actually the 'remote' party (the contact).
        // Correct.

        const contactPhone = msg.from; // This is the other person.

        try {
            // Find or create contact
            let contact = await this.findContact(contactPhone);
            const messageTime = msg.timestamp.toISOString();

            if (!contact) {
                contact = await this.createNewLead(contactPhone);

                // Update lead's last message for NEW lead
                if (!msg.fromMe) {
                    await pool.query(`
                        UPDATE leads
                        SET last_message = $1, 
                            last_message_time = $2,
                            unread_count = 1
                        WHERE cpf = $3
                    `, [msg.body, messageTime, contact.cpf]);
                }
            } else {
                // Update lead's last message for EXISTING lead
                if (!msg.fromMe) {
                    await pool.query(`
                        UPDATE leads 
                        SET last_message = $1,
                            last_message_time = $2,
                            unread_count = COALESCE(unread_count, 0) + 1
                        WHERE cpf = $3
                    `, [msg.body, messageTime, contact.cpf]);
                }
            }

            // Save message with media info
            const messageType = msg.mediaType || 'text';
            await pool.query(`
                INSERT INTO messages (id, contact_phone, content, from_me, timestamp, type, media_url, media_type, read)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING
            `, [
                msg.id,
                contact.cpf,
                msg.body,
                msg.fromMe,
                messageTime,
                messageType,
                msg.mediaUrl || null,
                msg.mediaType || null,
                msg.fromMe ? true : false
            ]);

            // Emit Socket Events
            if (!msg.fromMe) {
                // To CPF room
                emitNewMessage({
                    contactCpf: contact.cpf,
                    contactName: contact.nome,
                    message: {
                        id: 0,
                        message_id: msg.id,
                        direction: 'incoming',
                        body: msg.body,
                        media_url: msg.mediaUrl || null,
                        media_type: msg.mediaType || null,
                        timestamp: messageTime,
                        status: 'received'
                    }
                });

                // To Phone room
                emitNewMessageToPhone(contactPhone, {
                    contactName: contact.nome,
                    message: {
                        id: 0,
                        message_id: msg.id,
                        direction: 'incoming',
                        body: msg.body,
                        media_url: msg.mediaUrl || null,
                        media_type: msg.mediaType || null,
                        timestamp: messageTime,
                        status: 'received'
                    }
                });

                emitContactUpdated({
                    cpf: contact.cpf,
                    updates: {
                        last_message: msg.body,
                        last_message_time: messageTime,
                        last_message_direction: 'incoming',
                        unread_count: -1 // increment
                    }
                });
            }

            whatsappLogger.info(`Saved Baileys message from ${contact.nome}: ${msg.body.substring(0, 20)}...`);

        } catch (error) {
            whatsappLogger.error('Error handling Baileys message:', error);
        }
    }
}

export const baileysMessageHandler = new BaileysMessageHandler();
