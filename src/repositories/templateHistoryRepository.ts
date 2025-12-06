/**
 * Template History Repository - Data access layer
 * 
 * Follows DIP: Interface segregation, allows different implementations
 */

import db from '@/lib/db';
import { removeNonDigits, getPhoneVariations } from '@/lib/utils/phoneUtils';

// Run migration to ensure table exists
import '@/lib/migrations/addTemplateHistory';

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

export class SQLiteTemplateHistoryRepository implements ITemplateHistoryRepository {

    /**
     * Save template send history
     */
    async saveHistory(entry: Omit<TemplateHistoryEntry, 'id'>): Promise<void> {
        const stmt = db.prepare(`
            INSERT INTO template_history 
            (phone, template_name, template_content, sent_at, success, error_message)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            entry.phone,
            entry.template_name,
            entry.template_content,
            entry.sent_at,
            entry.success ? 1 : 0,
            entry.error_message || null
        );
    }

    /**
     * Find all template history for a phone number
     */
    async findByPhone(phone: string, limit: number = 50): Promise<TemplateHistoryEntry[]> {
        // Get phone variations for query
        const phoneVariations = getPhoneVariations(phone);

        const stmt = db.prepare(`
            SELECT 
                id,
                phone,
                template_name,
                template_content,
                sent_at,
                success,
                error_message
            FROM template_history
            WHERE phone = ? OR phone = ?
            ORDER BY sent_at DESC
            LIMIT ?
        `);

        const results = stmt.all(...phoneVariations, limit) as any[];

        return results.map(row => ({
            id: row.id,
            phone: row.phone,
            template_name: row.template_name,
            template_content: row.template_content,
            sent_at: row.sent_at,
            success: row.success === 1,
            error_message: row.error_message
        }));
    }

    /**
     * Update last template sent for a contact
     */
    async updateLastTemplate(phone: string, templateName: string): Promise<void> {
        const phoneVariations = getPhoneVariations(phone);

        const stmt = db.prepare(`
            UPDATE leads
            SET last_template_sent = ?,
                last_template_sent_at = CURRENT_TIMESTAMP
            WHERE telefone = ? OR telefone = ?
        `);

        stmt.run(templateName, ...phoneVariations);
    }

    /**
     * Get last template sent to a phone
     */
    async getLastTemplateSent(phone: string): Promise<string | null> {
        const phoneVariations = getPhoneVariations(phone);

        const stmt = db.prepare(`
            SELECT last_template_sent
            FROM leads
            WHERE telefone = ? OR telefone = ?
            LIMIT 1
        `);

        const result = stmt.get(...phoneVariations) as any;
        return result?.last_template_sent || null;
    }
}
