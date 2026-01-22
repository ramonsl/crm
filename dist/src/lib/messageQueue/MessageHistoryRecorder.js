"use strict";
/**
 * Message History Recorder
 *
 * Responsible for recording message history in the database.
 * Following SRP: Only handles message history recording.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHistoryRecorder = void 0;
const db_1 = require("../db");
const logger_1 = require("../../lib/logger");
class MessageHistoryRecorder {
    /**
     * Record a successful message send
     */
    async recordSuccess(item) {
        if (!item.cpf)
            return;
        try {
            // Prepare template name - use provider info for custom messages
            const templateName = item.templateName ||
                (item.provider === 'ycloud' ? 'YCloud Template' : 'Mensagem Personalizada');
            // For YCloud, message might be empty (template content not stored locally)
            const messageContent = item.message || `[Template: ${templateName}]`;
            await db_1.pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'sent')
            `, [item.cpf, item.templateId || null, templateName, messageContent]);
            // Update last_message and last_message_time in leads table
            await db_1.pool.query(`
                UPDATE leads 
                SET last_message = $1, 
                    last_message_time = NOW()
                WHERE cpf = $2
            `, [messageContent, item.cpf]);
            // Only update last_template_name if we have a real template name
            if (item.templateName) {
                await db_1.pool.query('UPDATE leads SET last_template_name = $1 WHERE cpf = $2', [item.templateName, item.cpf]);
            }
            // ALSO insert into messages table for Timeline visibility
            // Generate a unique message ID
            const messageId = `queue_${item.id}_${Date.now()}`;
            await db_1.pool.query(`
                INSERT INTO messages (id, contact_phone, content, from_me, timestamp, type)
                VALUES ($1, $2, $3, $4, NOW(), 'text')
                ON CONFLICT (id) DO NOTHING
            `, [messageId, item.phone, messageContent, true]);
            logger_1.queueLogger.info(`Recorded send: ${item.phone} via ${item.provider || 'whatsappjs'}`);
        }
        catch (error) {
            logger_1.queueLogger.error('Error recording success:', error);
        }
    }
    /**
     * Record a failed message send
     */
    async recordFailure(item) {
        if (!item.cpf)
            return;
        try {
            const templateName = item.templateName ||
                (item.provider === 'ycloud' ? 'YCloud Template' : 'Mensagem Personalizada');
            const messageContent = item.message || `[Template: ${templateName}]`;
            await db_1.pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'failed')
            `, [item.cpf, item.templateId || null, templateName, messageContent]);
        }
        catch (error) {
            logger_1.queueLogger.error('Error recording failure:', error);
        }
    }
}
exports.MessageHistoryRecorder = MessageHistoryRecorder;
