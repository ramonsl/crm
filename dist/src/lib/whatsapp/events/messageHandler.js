"use strict";
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
exports.MessageEventHandler = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../../../lib/logger");
const db_1 = require("../../db");
const messageQueue_1 = require("../../messageQueue");
const ActivityRepository_1 = require("../../repositories/ActivityRepository");
const activityService_1 = require("../../../services/activityService");
const emitter_1 = require("../../socket/emitter");
const phoneUtils_1 = require("../../utils/phoneUtils");
// Activity service for logging timeline events
const activityRepository = new ActivityRepository_1.ActivityRepository();
const activityService = new activityService_1.ActivityService(activityRepository);
class MessageEventHandler {
    constructor(state, autoReplyEnabled = true) {
        this.state = state;
        this.autoReplyEnabled = autoReplyEnabled;
    }
    /**
     * Get profile picture for a contact
     */
    async getContactProfilePicture(phone) {
        if (!this.state.isClientAvailable()) {
            return null;
        }
        try {
            const chatId = `${phone}@c.us`;
            return await this.state.client.getProfilePicUrl(chatId);
        }
        catch (_a) {
            return null;
        }
    }
    /**
     * Download and save media from message
     */
    async downloadMedia(msg) {
        if (!msg.hasMedia || !msg.downloadMedia) {
            return { url: null, type: null };
        }
        try {
            const media = await msg.downloadMedia();
            if (!media) {
                return { url: null, type: null };
            }
            const extension = media.mimetype.split('/')[1].split(';')[0];
            const filename = `${(0, uuid_1.v4)()}.${extension}`;
            const uploadDir = path_1.default.join(process.cwd(), 'public', 'uploads');
            if (!fs_1.default.existsSync(uploadDir)) {
                fs_1.default.mkdirSync(uploadDir, { recursive: true });
            }
            const filepath = path_1.default.join(uploadDir, filename);
            fs_1.default.writeFileSync(filepath, media.data, 'base64');
            const mediaUrl = `/uploads/${filename}`;
            const mediaType = media.mimetype.startsWith('image') ? 'image' :
                media.mimetype.startsWith('audio') ? 'audio' :
                    media.mimetype.startsWith('video') ? 'video' : 'document';
            logger_1.whatsappLogger.debug(` Media saved: ${mediaUrl} (${mediaType})`);
            return { url: mediaUrl, type: mediaType };
        }
        catch (mediaError) {
            logger_1.whatsappLogger.error(' Error downloading media:', mediaError);
            return { url: null, type: null };
        }
    }
    /**
     * Find contact in database by phone variations
     */
    async findContact(phone) {
        const variations = (0, phoneUtils_1.getPhoneVariations)(phone);
        logger_1.whatsappLogger.debug(`🔍 Buscando no banco por variações: ${variations.join(', ')}`);
        // Create placeholders for PostgreSQL ($1, $2, etc)
        const placeholders = variations.map((_, i) => `$${i + 1}`).join(',');
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
            logger_1.whatsappLogger.debug(`⚠️ Contato não encontrado por variações exatas. Tentando fallback pelos últimos 8 dígitos: ${last8}`);
            const fallbackResult = await db_1.pool.query('SELECT cpf, nome, telefone FROM leads WHERE telefone LIKE $1', [`%${last8}`]);
            contact = fallbackResult.rows[0];
            if (contact) {
                logger_1.whatsappLogger.debug(`✅ Contato encontrado via fallback (últimos 8 dígitos): ${contact.nome}`);
            }
        }
        return contact || null;
    }
    /**
     * Save message to database
     */
    async saveMessage(contact, msg, direction, messageTime) {
        var _a;
        const insertResult = await db_1.pool.query(`
      INSERT INTO messages (contact_phone, id, content, from_me, timestamp, type)
      VALUES ($1, $2, $3, $4, $5, 'text')
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `, [contact.cpf, msg.id.id, msg.body, direction === 'outgoing', messageTime]);
        const insertedId = ((_a = insertResult.rows[0]) === null || _a === void 0 ? void 0 : _a.id) || 0;
        logger_1.whatsappLogger.debug(`💾 Mensagem ${direction} salva no banco! ID: ${insertedId}`);
        messageQueue_1.messageQueue.addLog(`💾 Mensagem salva! ID: ${insertedId}`, 'success');
        return insertedId;
    }
    /**
     * Update lead's last message information
     */
    async updateLeadLastMessage(cpf, body, messageTime, mediaType) {
        logger_1.whatsappLogger.debug(` 🔄 Tentando atualizar last_message para CPF: ${cpf}`);
        try {
            const updateResult = await db_1.pool.query(`
        UPDATE leads 
        SET last_message = $1,
            last_message_time = $2
        WHERE cpf = $3
      `, [body || (mediaType ? `[${mediaType}]` : 'Mensagem'), messageTime, cpf]);
            logger_1.whatsappLogger.debug(`✅ Lead ${cpf} UPDATE executado! Changes: ${updateResult.rowCount}`);
            if (updateResult.rowCount === 0) {
                logger_1.whatsappLogger.warn(`⚠️ UPDATE não afetou nenhuma linha! CPF ${cpf} pode não existir na tabela leads`);
            }
        }
        catch (updateError) {
            logger_1.whatsappLogger.error(' ❌ Error updating lead last_message:', updateError);
        }
    }
    /**
     * Emit socket events for real-time updates
     */
    emitSocketEvents(contact, phone, insertedId, msg, direction, messageTime, mediaUrl, mediaType) {
        if (direction !== 'incoming') {
            logger_1.whatsappLogger.debug(`[Socket] ⏭️ Skipping emit for OUTGOING message (no notification needed)`);
            return;
        }
        try {
            // Emit to CPF room (for existing chat page)
            const emittedToCpf = (0, emitter_1.emitNewMessage)({
                contactCpf: contact.cpf,
                contactName: contact.nome || contact.telefone,
                message: {
                    id: insertedId,
                    message_id: msg.id.id,
                    direction,
                    body: msg.body,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    timestamp: messageTime,
                    status: 'sent'
                }
            });
            // Also emit to phone room (for WhatsApp POC)
            const emittedToPhone = (0, emitter_1.emitNewMessageToPhone)(phone, {
                contactName: contact.nome || contact.telefone,
                message: {
                    id: insertedId,
                    message_id: msg.id.id,
                    direction,
                    body: msg.body,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    timestamp: messageTime,
                    status: 'sent'
                }
            });
            if (emittedToCpf || emittedToPhone) {
                logger_1.whatsappLogger.debug(`[Socket] ✅ Event emitted for INCOMING message from CPF:${contact.cpf} Phone:${phone}`);
            }
            else {
                logger_1.whatsappLogger.error(`[Socket] ❌ FAILED to emit - Socket.io not ready!`);
            }
        }
        catch (socketError) {
            logger_1.whatsappLogger.warn('[Socket] Could not emit message event:', socketError);
        }
    }
    /**
     * Handle incoming message for unread count and activity logging
     */
    async handleIncomingMessageUpdates(contact, body, messageTime, mediaType) {
        // Increment unread count
        await db_1.pool.query(`
      UPDATE leads
      SET unread_count = COALESCE(unread_count, 0) + 1
      WHERE cpf = $1
    `, [contact.cpf]);
        // Emit contact update event
        try {
            (0, emitter_1.emitContactUpdated)({
                cpf: contact.cpf,
                updates: {
                    last_message: body || (mediaType ? `[${mediaType}]` : 'Mensagem'),
                    last_message_time: messageTime,
                    last_message_direction: 'incoming',
                    unread_count: -1 // Signal to increment on client side
                }
            });
        }
        catch (socketError) {
            logger_1.whatsappLogger.warn('[Socket] Could not emit contact update:', socketError);
        }
        // Log activity: WhatsApp received
        try {
            activityService.logWhatsAppReceived(contact.cpf, body || `[${mediaType || 'mídia'}]`);
        }
        catch (activityError) {
            logger_1.whatsappLogger.error(' Error logging activity:', activityError);
        }
    }
    /**
     * Create a new lead for unknown contact
     */
    async createNewLead(phone, msg) {
        var _a;
        logger_1.whatsappLogger.debug(`⚠️ Contato não encontrado. Criando novo lead para: ${phone}`);
        // Get contact info
        let contactName = phone;
        try {
            const chatContact = await msg.getContact();
            contactName = chatContact.pushname || chatContact.name || chatContact.number || phone;
        }
        catch (e) {
            logger_1.whatsappLogger.error('Error fetching contact info:', e);
            contactName = ((_a = msg._data) === null || _a === void 0 ? void 0 : _a.notifyName) || phone;
        }
        const tempCpf = phone; // Use phone as temporary CPF
        await db_1.pool.query(`
      INSERT INTO leads (cpf, nome, telefone, status, created_at)
      VALUES ($1, $2, $3, 'LEAD', NOW())
    `, [tempCpf, contactName, phone]);
        messageQueue_1.messageQueue.addLog(`✨ Novo lead criado: ${contactName}`, 'success');
        return { cpf: tempCpf, nome: contactName, telefone: phone };
    }
    /**
     * Handle auto-reply for incoming messages
     */
    async handleAutoReply(phone, body, msg) {
        if (!this.autoReplyEnabled || !body || !body.trim()) {
            return;
        }
        try {
            // Import auto-reply service dynamically to avoid circular dependencies
            const { autoReplyService } = await Promise.resolve().then(() => __importStar(require('../../../services/autoReplyService')));
            logger_1.whatsappLogger.debug(`🤖 Processing auto-reply for message from ${phone}: "${body}"`);
            const response = await autoReplyService.processIncomingMessage(phone, body);
            if (response && typeof response === 'string') {
                logger_1.whatsappLogger.debug(`🤖 Sending auto-reply to ${phone}: "${response}"`);
                // Add a small delay to seem more human
                await new Promise(resolve => setTimeout(resolve, 1500));
                if (msg.reply) {
                    await msg.reply(response);
                    messageQueue_1.messageQueue.addLog(`🤖 Auto-resposta enviada para ${phone}`, 'success');
                    logger_1.whatsappLogger.debug(`✅ Auto-reply sent successfully to ${phone}`);
                }
            }
            else {
                logger_1.whatsappLogger.debug(`ℹ️ No auto-reply triggered for message from ${phone}`);
            }
        }
        catch (error) {
            logger_1.whatsappLogger.error(' Error processing auto-reply:', error);
        }
    }
    /**
     * Main handler for message_create event
     */
    async handle(msg) {
        var _a, _b;
        logger_1.whatsappLogger.debug('🔔 EVENT message_create DISPARADO!');
        // Only process direct messages (not groups)
        if (!msg.from.endsWith('@c.us') && !((_a = msg.to) === null || _a === void 0 ? void 0 : _a.endsWith('@c.us'))) {
            return;
        }
        // Determine phone number and direction
        let phone;
        let direction;
        if (msg.fromMe) {
            phone = ((_b = msg.to) === null || _b === void 0 ? void 0 : _b.replace('@c.us', '')) || '';
            direction = 'outgoing';
        }
        else {
            phone = msg.from.replace('@c.us', '');
            direction = 'incoming';
        }
        if (!phone)
            return;
        // Handle auto-reply for incoming messages
        if (direction === 'incoming') {
            await this.handleAutoReply(phone, msg.body, msg);
        }
        logger_1.whatsappLogger.debug('='.repeat(60));
        logger_1.whatsappLogger.debug(`📱 MENSAGEM ${direction.toUpperCase()} ${direction === 'outgoing' ? 'para' : 'de'} ${phone}`);
        logger_1.whatsappLogger.debug(`📝 Conteúdo: ${msg.body}`);
        messageQueue_1.messageQueue.addLog(`📱 ${direction === 'outgoing' ? 'Enviada para' : 'Recebida de'} ${phone}: ${msg.body}`, 'info');
        try {
            // Find or create contact
            let contact = await this.findContact(phone);
            const messageTime = new Date(msg.timestamp * 1000).toISOString();
            const { url: mediaUrl, type: mediaType } = await this.downloadMedia(msg);
            if (contact) {
                logger_1.whatsappLogger.debug(`✅ Contato cadastrado: ${contact.nome} (CPF: ${contact.cpf}, Tel: ${contact.telefone})`);
                messageQueue_1.messageQueue.addLog(`✅ ${contact.nome}: ${msg.body}`, 'success');
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
                            await db_1.pool.query('UPDATE leads SET profile_image = $1 WHERE cpf = $2', [profilePicUrl, contact.cpf]);
                            logger_1.whatsappLogger.debug(` ✓ Profile picture updated for ${contact.nome}`);
                        }
                        catch (err) {
                            logger_1.whatsappLogger.error(' Error updating profile picture:', err);
                        }
                    }
                }).catch(err => {
                    logger_1.whatsappLogger.error(' Error fetching profile picture:', err);
                });
            }
            else {
                // Create new lead
                try {
                    contact = await this.createNewLead(phone, msg);
                    // Save message for new lead
                    const insertedId = await this.saveMessage(contact, msg, direction, messageTime);
                    logger_1.whatsappLogger.debug(`💾 Mensagem ${direction} salva para novo lead! ID: ${insertedId}`);
                    // Update lead's last message
                    if (direction === 'incoming') {
                        await db_1.pool.query(`
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
                                await db_1.pool.query('UPDATE leads SET profile_image = $1 WHERE cpf = $2', [profilePicUrl, contact.cpf]);
                            }
                            catch (err) {
                                logger_1.whatsappLogger.error(' Error updating profile picture:', err);
                            }
                        }
                    });
                }
                catch (err) {
                    logger_1.whatsappLogger.error('Erro ao criar novo lead:', err);
                    messageQueue_1.messageQueue.addLog(`❌ Erro ao criar lead: ${err}`, 'error');
                }
            }
        }
        catch (error) {
            logger_1.whatsappLogger.error('Erro ao processar mensagem:', error);
            messageQueue_1.messageQueue.addLog(`❌ Erro: ${error}`, 'error');
        }
        logger_1.whatsappLogger.debug('='.repeat(60));
    }
}
exports.MessageEventHandler = MessageEventHandler;
