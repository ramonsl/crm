"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baileysMessageHandler = exports.BaileysMessageHandler = void 0;
const db_1 = require("../lib/db");
const logger_1 = require("../lib/logger");
const messageQueue_1 = require("../lib/messageQueue");
const emitter_1 = require("../lib/socket/emitter");
const phoneUtils_1 = require("../lib/utils/phoneUtils");
class BaileysMessageHandler {
    constructor(autoReplyEnabled = true) {
        this.autoReplyEnabled = autoReplyEnabled;
    }
    /**
     * Find contact in database by phone variations
     */
    async findContact(phone) {
        const variations = (0, phoneUtils_1.getPhoneVariations)(phone);
        // Create placeholders for PostgreSQL ($1, $2, etc)
        const placeholders = variations.map((_, i) => `$${i + 1}`).join(',');
        // Query to find contact by any phone variation
        const result = await db_1.pool.query(`
            SELECT cpf, nome, telefone FROM leads 
            WHERE telefone IN (${placeholders})
            ORDER BY CASE WHEN cpf != telefone THEN 0 ELSE 1 END, cpf
            LIMIT 1
        `, variations);
        let contact = result.rows[0];
        // Fallback: Try matching by last 8 digits
        if (!contact && phone.length >= 8) {
            const last8 = phone.slice(-8);
            const fallbackResult = await db_1.pool.query('SELECT cpf, nome, telefone FROM leads WHERE telefone LIKE $1', [`%${last8}`]);
            contact = fallbackResult.rows[0];
        }
        return contact || null;
    }
    /**
     * Save message to database
     */
    async saveMessage(contact, msg, insertTime) {
        var _a;
        const insertResult = await db_1.pool.query(`
            INSERT INTO messages (contact_phone, id, content, from_me, timestamp, type)
            VALUES ($1, $2, $3, $4, $5, 'text')
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        `, [contact.cpf, msg.id, msg.body, msg.fromMe, insertTime]);
        const insertedId = ((_a = insertResult.rows[0]) === null || _a === void 0 ? void 0 : _a.id) || 0; // If duplicate, id might be missing or we need to query it? 
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
    async createNewLead(phone) {
        logger_1.whatsappLogger.debug(`⚠️ Contato não encontrado. Criando novo lead para: ${phone}`);
        const contactName = phone;
        const tempCpf = phone; // Use phone as temporary CPF
        await db_1.pool.query(`
            INSERT INTO leads (cpf, nome, telefone, status, created_at)
            VALUES ($1, $2, $3, 'LEAD', NOW())
            ON CONFLICT (cpf) DO NOTHING
        `, [tempCpf, contactName, phone]);
        messageQueue_1.messageQueue.addLog(`✨ Novo lead criado: ${contactName}`, 'success');
        return { cpf: tempCpf, nome: contactName, telefone: phone };
    }
    /**
     * Handle incoming/outgoing message
     */
    async handle(msg) {
        // Skip groups for now (simplified)
        if (msg.isGroup)
            return;
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
                    await db_1.pool.query(`
                        UPDATE leads
                        SET last_message = $1, 
                            last_message_time = $2,
                            unread_count = 1
                        WHERE cpf = $3
                    `, [msg.body, messageTime, contact.cpf]);
                }
            }
            else {
                // Update lead's last message for EXISTING lead
                if (!msg.fromMe) {
                    await db_1.pool.query(`
                        UPDATE leads 
                        SET last_message = $1,
                            last_message_time = $2,
                            unread_count = COALESCE(unread_count, 0) + 1
                        WHERE cpf = $3
                    `, [msg.body, messageTime, contact.cpf]);
                }
            }
            // Save message
            await db_1.pool.query(`
                INSERT INTO messages (id, contact_phone, content, from_me, timestamp, type, read)
                VALUES ($1, $2, $3, $4, $5, 'text', $6)
                ON CONFLICT (id) DO NOTHING
            `, [
                msg.id,
                contact.cpf, // Using CPF as foreign key reference if schema requires it? 
                // Schema check: messages table contact_phone column.
                // Is it FK to leads(cpf)? 
                // Schema does NOT show generic FK. 
                // But legacy code: INSERT INTO messages (contact_phone...) VALUES ($1...) [contact.cpf]
                // So it stores CPF in contact_phone column? That's confusing naming but consistent with legacy.
                msg.body,
                msg.fromMe,
                messageTime,
                msg.fromMe ? true : false // read
            ]);
            // Emit Socket Events
            if (!msg.fromMe) {
                // To CPF room
                (0, emitter_1.emitNewMessage)({
                    contactCpf: contact.cpf,
                    contactName: contact.nome,
                    message: {
                        id: 0, // database valid id? 
                        message_id: msg.id,
                        direction: 'incoming',
                        body: msg.body,
                        media_url: null,
                        media_type: null,
                        timestamp: messageTime,
                        status: 'received'
                    }
                });
                // To Phone room
                (0, emitter_1.emitNewMessageToPhone)(contactPhone, {
                    contactName: contact.nome,
                    message: {
                        id: 0,
                        message_id: msg.id,
                        direction: 'incoming',
                        body: msg.body,
                        media_url: null,
                        media_type: null,
                        timestamp: messageTime,
                        status: 'received'
                    }
                });
                (0, emitter_1.emitContactUpdated)({
                    cpf: contact.cpf,
                    updates: {
                        last_message: msg.body,
                        last_message_time: messageTime,
                        last_message_direction: 'incoming',
                        unread_count: -1 // increment
                    }
                });
            }
            logger_1.whatsappLogger.info(`Saved Baileys message from ${contact.nome}: ${msg.body.substring(0, 20)}...`);
        }
        catch (error) {
            logger_1.whatsappLogger.error('Error handling Baileys message:', error);
        }
    }
}
exports.BaileysMessageHandler = BaileysMessageHandler;
exports.baileysMessageHandler = new BaileysMessageHandler();
