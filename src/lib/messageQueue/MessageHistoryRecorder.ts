/**
 * Message History Recorder
 * 
 * Responsible for recording message history in the database.
 * Following SRP: Only handles message history recording.
 */

import type { IMessageHistoryRecorder } from './interfaces';
import type { QueueItem } from './types';
import { pool } from '../db';
import { queueLogger } from '@/lib/logger';

export class MessageHistoryRecorder implements IMessageHistoryRecorder {
    /**
     * Record a successful message send
     */
    async recordSuccess(item: QueueItem): Promise<void> {
        if (!item.cpf) return;

        try {
            // Prepare template name - use provider info for custom messages
            const templateName = item.templateName ||
                (item.provider === 'ycloud' ? 'YCloud Template' : 'Mensagem Personalizada');

            // For YCloud, message might be empty (template content not stored locally)
            const messageContent = item.message || `[Template: ${templateName}]`;

            await pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'sent')
            `, [item.cpf, item.templateId || null, templateName, messageContent]);

            // Only update last_template_name if we have a real template name
            if (item.templateName) {
                await pool.query(
                    'UPDATE leads SET last_template_name = $1 WHERE cpf = $2',
                    [item.templateName, item.cpf]
                );
            }

            queueLogger.info(`Recorded send: ${item.phone} via ${item.provider || 'whatsappjs'}`);
        } catch (error) {
            queueLogger.error('Error recording success:', error);
        }
    }

    /**
     * Record a failed message send
     */
    async recordFailure(item: QueueItem): Promise<void> {
        if (!item.cpf) return;

        try {
            const templateName = item.templateName ||
                (item.provider === 'ycloud' ? 'YCloud Template' : 'Mensagem Personalizada');
            const messageContent = item.message || `[Template: ${templateName}]`;

            await pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'failed')
            `, [item.cpf, item.templateId || null, templateName, messageContent]);
        } catch (error) {
            queueLogger.error('Error recording failure:', error);
        }
    }
}

