/**
 * Message History Recorder
 * 
 * Responsible for recording message history in the database.
 * Following SRP: Only handles message history recording.
 */

import type { IMessageHistoryRecorder } from './interfaces';
import type { QueueItem } from './types';
import { pool } from '../db';

export class MessageHistoryRecorder implements IMessageHistoryRecorder {
    /**
     * Record a successful message send
     */
    async recordSuccess(item: QueueItem): Promise<void> {
        if (!item.cpf || !item.templateName) return;

        try {
            await pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'sent')
            `, [item.cpf, item.templateId || null, item.templateName, item.message]);

            await pool.query(
                'UPDATE leads SET last_template_name = $1 WHERE cpf = $2',
                [item.templateName, item.cpf]
            );
        } catch (error) {
            console.error('[MessageHistoryRecorder] Error recording success:', error);
        }
    }

    /**
     * Record a failed message send
     */
    async recordFailure(item: QueueItem): Promise<void> {
        if (!item.cpf || !item.templateName) return;

        try {
            await pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'failed')
            `, [item.cpf, item.templateId || null, item.templateName, item.message]);
        } catch (error) {
            console.error('[MessageHistoryRecorder] Error recording failure:', error);
        }
    }
}
