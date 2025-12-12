/**
 * Template History Repository - Data access layer
 * 
 * Follows DIP: Interface segregation, allows different implementations
 * Uses Neon PostgreSQL for data persistence.
 */

import { pool, query, queryOne } from '@/lib/db';
import { removeNonDigits, getPhoneVariations } from '@/lib/utils/phoneUtils';

export interface TemplateHistoryEntry {
    id: number;
    phone: string;
    template_name: string;
    template_content: string;
    sent_at: string;
    success: boolean;
    error_message?: string | null;
}

export interface ITemplateHistoryRepository {
    saveHistory(entry: Omit<TemplateHistoryEntry, 'id'>): Promise<void>;
    findByPhone(phone: string, limit?: number): Promise<TemplateHistoryEntry[]>;
    updateLastTemplate(phone: string, templateName: string): Promise<void>;
    getLastTemplateSent(phone: string): Promise<string | null>;
}

/**
 * PostgreSQL implementation of template history repository
 */
export class NeonTemplateHistoryRepository implements ITemplateHistoryRepository {

    /**
     * Save template send history
     */
    async saveHistory(entry: Omit<TemplateHistoryEntry, 'id'>): Promise<void> {
        await pool.query(`
            INSERT INTO template_history 
            (phone, template_name, template_content, sent_at, success, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            entry.phone,
            entry.template_name,
            entry.template_content,
            entry.sent_at,
            entry.success,
            entry.error_message || null
        ]);
    }

    /**
     * Find all template history for a phone number
     */
    async findByPhone(phone: string, limit: number = 50): Promise<TemplateHistoryEntry[]> {
        // Get phone variations for query
        const phoneVariations = getPhoneVariations(phone);

        const result = await pool.query(`
            SELECT 
                id,
                phone,
                template_name,
                template_content,
                sent_at,
                success,
                error_message
            FROM template_history
            WHERE phone = $1 OR phone = $2
            ORDER BY sent_at DESC
            LIMIT $3
        `, [...phoneVariations, limit]);

        return result.rows.map((row: any) => ({
            id: row.id,
            phone: row.phone,
            template_name: row.template_name,
            template_content: row.template_content,
            sent_at: row.sent_at,
            success: row.success === true || row.success === 1,
            error_message: row.error_message
        }));
    }

    /**
     * Update last template sent for a contact
     */
    async updateLastTemplate(phone: string, templateName: string): Promise<void> {
        const phoneVariations = getPhoneVariations(phone);

        await pool.query(`
            UPDATE leads
            SET last_template_sent = $1,
                last_template_sent_at = CURRENT_TIMESTAMP
            WHERE telefone = $2 OR telefone = $3
        `, [templateName, ...phoneVariations]);
    }

    /**
     * Get last template sent to a phone
     */
    async getLastTemplateSent(phone: string): Promise<string | null> {
        const phoneVariations = getPhoneVariations(phone);

        const result = await pool.query(`
            SELECT last_template_sent
            FROM leads
            WHERE telefone = $1 OR telefone = $2
            LIMIT 1
        `, phoneVariations);

        return result.rows[0]?.last_template_sent || null;
    }
}

// Alias for backward compatibility
export const SQLiteTemplateHistoryRepository = NeonTemplateHistoryRepository;
