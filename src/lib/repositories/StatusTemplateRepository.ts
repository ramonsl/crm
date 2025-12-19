/**
 * StatusTemplateRepository
 * 
 * Manages the association between statuses and message templates.
 * Enables automated message sending when leads change to specific statuses.
 * 
 * Following SOLID principles:
 * - SRP: Only handles status-template association data
 * - DIP: Uses pool from db module
 */

import { pool } from '@/lib/db';

export interface StatusTemplateRow {
    id: number;
    status_name: string;
    template_id: number | null;
    is_active: boolean;
    created_at: string;
}

export interface StatusTemplateWithTemplate extends StatusTemplateRow {
    template_name: string | null;
    template_message: string | null;
}

export class StatusTemplateRepository {
    /**
     * Find template association by status name
     */
    async findByStatus(statusName: string): Promise<StatusTemplateRow | null> {
        const result = await pool.query(`
            SELECT * FROM status_templates 
            WHERE status_name = $1 AND is_active = true
        `, [statusName]);
        return result.rows[0] || null;
    }

    /**
     * Get all status-template associations with template details
     */
    async findAllWithTemplates(): Promise<StatusTemplateWithTemplate[]> {
        const result = await pool.query(`
            SELECT 
                st.id,
                st.status_name,
                st.template_id,
                st.is_active,
                st.created_at,
                t.name as template_name,
                t.message as template_message
            FROM status_templates st
            LEFT JOIN templates t ON st.template_id = t.id
            ORDER BY st.status_name
        `);
        return result.rows;
    }

    /**
     * Create or update a status-template association (upsert)
     */
    async upsert(statusName: string, templateId: number | null, isActive: boolean = true): Promise<void> {
        await pool.query(`
            INSERT INTO status_templates (status_name, template_id, is_active)
            VALUES ($1, $2, $3)
            ON CONFLICT (status_name) 
            DO UPDATE SET template_id = $2, is_active = $3
        `, [statusName, templateId, isActive]);
    }

    /**
     * Delete a status-template association
     */
    async delete(statusName: string): Promise<void> {
        await pool.query(`
            DELETE FROM status_templates WHERE status_name = $1
        `, [statusName]);
    }

    /**
     * Toggle active status
     */
    async toggleActive(statusName: string, isActive: boolean): Promise<void> {
        await pool.query(`
            UPDATE status_templates SET is_active = $1 WHERE status_name = $2
        `, [isActive, statusName]);
    }
}

// Export singleton instance
export const statusTemplateRepository = new StatusTemplateRepository();
