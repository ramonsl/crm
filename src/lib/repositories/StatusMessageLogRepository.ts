/**
 * StatusMessageLogRepository
 * 
 * Tracks automated messages sent for each lead+status combination.
 * Prevents duplicate sends when a lead cycles back to the same status.
 * 
 * Following SOLID principles:
 * - SRP: Only handles deduplication log data
 * - DIP: Uses pool from db module
 */

import { pool } from '@/lib/db';

export interface StatusMessageLogRow {
    id: number;
    contact_cpf: string;
    status_name: string;
    template_id: number | null;
    message_id: string | null;
    sent_at: string;
}

export class StatusMessageLogRepository {
    /**
     * Check if a message has already been sent for this CPF+status combination
     */
    async hasBeenSent(cpf: string, statusName: string): Promise<boolean> {
        const result = await pool.query(`
            SELECT 1 FROM status_message_log 
            WHERE contact_cpf = $1 AND status_name = $2
            LIMIT 1
        `, [cpf, statusName]);
        return result.rows.length > 0;
    }

    /**
     * Log that a message was sent for this CPF+status
     * Uses INSERT ... ON CONFLICT to handle race conditions
     */
    async logSent(
        cpf: string,
        statusName: string,
        templateId?: number,
        messageId?: string
    ): Promise<void> {
        await pool.query(`
            INSERT INTO status_message_log (contact_cpf, status_name, template_id, message_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (contact_cpf, status_name) DO NOTHING
        `, [cpf, statusName, templateId || null, messageId || null]);
    }

    /**
     * Find all message logs for a specific CPF
     */
    async findByCpf(cpf: string): Promise<StatusMessageLogRow[]> {
        const result = await pool.query(`
            SELECT * FROM status_message_log 
            WHERE contact_cpf = $1
            ORDER BY sent_at DESC
        `, [cpf]);
        return result.rows;
    }

    /**
     * Delete all logs for a CPF (useful for testing or reset)
     */
    async deleteForCpf(cpf: string): Promise<void> {
        await pool.query(`
            DELETE FROM status_message_log WHERE contact_cpf = $1
        `, [cpf]);
    }

    /**
     * Delete a specific log entry (allows re-sending)
     */
    async deleteEntry(cpf: string, statusName: string): Promise<void> {
        await pool.query(`
            DELETE FROM status_message_log 
            WHERE contact_cpf = $1 AND status_name = $2
        `, [cpf, statusName]);
    }
}

// Export singleton instance
export const statusMessageLogRepository = new StatusMessageLogRepository();
