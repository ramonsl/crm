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
        if (!item.cpf || !item.templateName)
            return;
        try {
            await db_1.pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'sent')
            `, [item.cpf, item.templateId || null, item.templateName, item.message]);
            await db_1.pool.query('UPDATE leads SET last_template_name = $1 WHERE cpf = $2', [item.templateName, item.cpf]);
        }
        catch (error) {
            logger_1.queueLogger.error('Error recording success:', error);
        }
    }
    /**
     * Record a failed message send
     */
    async recordFailure(item) {
        if (!item.cpf || !item.templateName)
            return;
        try {
            await db_1.pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'failed')
            `, [item.cpf, item.templateId || null, item.templateName, item.message]);
        }
        catch (error) {
            logger_1.queueLogger.error('Error recording failure:', error);
        }
    }
}
exports.MessageHistoryRecorder = MessageHistoryRecorder;
